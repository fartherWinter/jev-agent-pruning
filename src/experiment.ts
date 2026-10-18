import { parseAgentCandidates, parseJevDecision, runPairedExperiment, type Candidate, type CandidateCategory, type Decision, type PairedExperiment, type Scenario } from "./core.js";

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelCompletion {
  content: string;
  model: string;
  usage: ModelUsage;
  latencyMs: number;
}

export interface ExperimentRun extends PairedExperiment {
  runId: string;
  task: string;
  category: CandidateCategory;
  model: string;
  candidates: Candidate[];
  decisions: Decision[];
  metrics: {
    agent: ModelUsage & { latencyMs: number };
    jev: ModelUsage & { latencyMs: number };
    sharedTokens: number;
    baselineTotalTokens: number;
    jevTotalTokens: number;
    baselineTotalLatencyMs: number;
    jevTotalLatencyMs: number;
    endToEndLatencyMs: number;
  };
  evaluation: "fixed-scenario" | "keyword-simulation";
}

export type ModelCaller = (input: {
  purpose: "agent" | "jev";
  task: string;
  category: CandidateCategory;
  model: string;
  candidateCatalog: Candidate[];
  candidates?: Candidate[];
}) => Promise<ModelCompletion>;

export async function runExperiment(input: {
  scenario: Scenario;
  task: string;
  model: string;
  complete: ModelCaller;
}): Promise<ExperimentRun> {
  const startedAt = performance.now();
  const catalog = input.scenario.catalog;
  if (!catalog || catalog.length < 2) throw new Error("Scenario does not have a candidate catalog.");
  const agent = await input.complete({ purpose: "agent", task: input.task, category: input.scenario.category, model: input.model, candidateCatalog: catalog });
  const candidates = parseAgentCandidates(agent.content);
  const allowed = new Set(catalog.map((candidate) => candidate.id));
  if (candidates.some((candidate) => !allowed.has(candidate.id))) throw new Error("Agent returned a candidate id outside this scenario catalog.");
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) throw new Error("Agent returned duplicate candidate ids.");
  const jev = await input.complete({ purpose: "jev", task: input.task, category: input.scenario.category, model: input.model, candidateCatalog: catalog, candidates });
  const decisions = parseJevDecision(jev.content, candidates);
  const paired = runPairedExperiment({ candidates, decisions, scenario: input.scenario, userTask: input.task });
  const endToEndLatencyMs = Math.round(performance.now() - startedAt);
  return {
    runId: crypto.randomUUID(), task: input.task, category: input.scenario.category,
    model: jev.model || agent.model, candidates, decisions, ...paired,
    metrics: {
      agent: { ...agent.usage, latencyMs: agent.latencyMs },
      jev: { ...jev.usage, latencyMs: jev.latencyMs },
      sharedTokens: agent.usage.totalTokens,
      baselineTotalTokens: agent.usage.totalTokens + paired.baseline.executedTokens,
      jevTotalTokens: agent.usage.totalTokens + jev.usage.totalTokens + paired.jev.executedTokens,
      baselineTotalLatencyMs: agent.latencyMs + paired.baseline.executionLatencyMs,
      jevTotalLatencyMs: agent.latencyMs + jev.latencyMs + paired.jev.executionLatencyMs,
      endToEndLatencyMs,
    },
    evaluation: input.scenario.id === "custom" ? "keyword-simulation" : "fixed-scenario",
  };
}
