export type CandidateCategory = "skill" | "model" | "tool";

export interface Candidate {
  id: string;
  title: string;
  nodes: string[];
  rationale: string;
  estimatedTokens?: number;
}

export interface Decision {
  id: string;
  keep: boolean;
  reason: string;
}

export interface PathEvaluation {
  success: boolean;
  result: string;
  tokens: number;
  latencyMs: number;
  successKeywords?: string[];
}

export interface Scenario {
  id: string;
  title: string;
  category: CandidateCategory;
  task: string;
  expected: string;
  catalog?: Candidate[];
  paths: Record<string, PathEvaluation>;
}

export interface BranchResult {
  success: boolean;
  result: string;
  error?: string;
  executedPathIds: string[];
  executedTokens: number;
  executionLatencyMs: number;
  successPathId?: string;
}

export interface PairedExperiment {
  baseline: BranchResult;
  jev: BranchResult;
}

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`${label} response is not valid JSON.`);
  }
}

export function parseAgentCandidates(raw: string): Candidate[] {
  const value = parseJsonObject(raw, "Agent");
  if (!Array.isArray(value.candidates) || value.candidates.length < 2 || value.candidates.length > 8) {
    throw new Error("Agent must return between 2 and 8 candidates.");
  }
  const seen = new Set<string>();
  return value.candidates.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Agent candidate ${index + 1} is invalid.`);
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || !candidate.id.trim() || seen.has(candidate.id)) throw new Error(`Agent candidate ${index + 1} has an invalid or duplicate id.`);
    seen.add(candidate.id);
    if (typeof candidate.title !== "string" || !candidate.title.trim()) throw new Error(`Agent candidate ${index + 1} is missing a title.`);
    if (!Array.isArray(candidate.nodes) || candidate.nodes.length < 2 || candidate.nodes.some((node) => typeof node !== "string" || !node.trim())) {
      throw new Error(`Agent candidate ${index + 1} must include at least two path nodes.`);
    }
    if (typeof candidate.rationale !== "string" || !candidate.rationale.trim()) throw new Error(`Agent candidate ${index + 1} is missing its rationale.`);
    return {
      id: candidate.id,
      title: candidate.title.trim(),
      nodes: candidate.nodes as string[],
      rationale: candidate.rationale.trim(),
      ...(typeof candidate.estimatedTokens === "number" ? { estimatedTokens: candidate.estimatedTokens } : {}),
    };
  });
}

export function parseJevDecision(raw: string, candidates: Candidate[]): Decision[] {
  const value = parseJsonObject(raw, "Jev");
  if (!Array.isArray(value.decisions)) throw new Error("Jev response must contain a decisions array.");
  const expected = new Set(candidates.map((candidate) => candidate.id));
  const seen = new Set<string>();
  const decisions = value.decisions.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`Jev decision ${index + 1} is invalid.`);
    const decision = item as Record<string, unknown>;
    if (typeof decision.id !== "string" || !expected.has(decision.id)) throw new Error(`Jev returned an unknown candidate id: ${String(decision.id)}.`);
    if (seen.has(decision.id)) throw new Error(`Jev returned a duplicate decision for ${decision.id}.`);
    if (typeof decision.keep !== "boolean" || typeof decision.reason !== "string" || !decision.reason.trim()) {
      throw new Error(`Jev decision for ${decision.id} must include keep and a reason.`);
    }
    seen.add(decision.id);
    return { id: decision.id, keep: decision.keep, reason: decision.reason.trim() };
  });
  if (seen.size !== expected.size) throw new Error("Jev must return exactly one decision for every candidate.");
  if (!decisions.some((decision) => decision.keep)) throw new Error("Jev must keep at least one candidate.");
  return candidates.map((candidate) => decisions.find((decision) => decision.id === candidate.id)!);
}

function executePaths(candidates: Candidate[], scenario: Scenario, task: string): BranchResult {
  const normalizedTask = task.toLocaleLowerCase();
  const evaluations = candidates.map((candidate) => {
    const configured = scenario.paths[candidate.id];
    if (!configured) throw new Error(`No local simulation exists for candidate ${candidate.id}.`);
    let success = configured.success;
    if (scenario.id === "custom") {
      const keywords = configured.successKeywords ?? [];
      success = keywords.some((keyword) => normalizedTask.includes(keyword.toLocaleLowerCase()));
    }
    return { candidate, evaluation: { ...configured, success } };
  });
  const winner = evaluations.find(({ evaluation }) => evaluation.success);
  return {
    success: Boolean(winner),
    result: winner?.evaluation.result ?? "No retained path completed the task.",
    ...(!winner ? { error: "No retained path completed the task." } : {}),
    executedPathIds: evaluations.map(({ candidate }) => candidate.id),
    executedTokens: evaluations.reduce((total, { evaluation }) => total + evaluation.tokens, 0),
    executionLatencyMs: evaluations.reduce((total, { evaluation }) => total + evaluation.latencyMs, 0),
    ...(winner ? { successPathId: winner.candidate.id } : {}),
  };
}

export function runPairedExperiment(input: {
  candidates: Candidate[];
  decisions: Decision[];
  scenario: Scenario;
  userTask: string;
}): PairedExperiment {
  const byId = new Map(input.decisions.map((decision) => [decision.id, decision]));
  const baseline = executePaths(input.candidates, input.scenario, input.userTask);
  const kept = input.candidates.filter((candidate) => byId.get(candidate.id)?.keep);
  if (kept.length === 0) throw new Error("Jev must keep at least one candidate.");
  const jev = executePaths(kept, input.scenario, input.userTask);
  return { baseline, jev };
}
