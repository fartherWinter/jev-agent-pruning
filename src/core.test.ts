import test from "node:test";
import assert from "node:assert/strict";
import {
  parseAgentCandidates,
  parseJevDecision,
  runPairedExperiment,
  type Candidate,
  type Scenario,
} from "./core.js";

const candidates: Candidate[] = [
  { id: "path-a", title: "Fast route", nodes: ["Project", "Topic", "Skill"], rationale: "Fast", estimatedTokens: 100 },
  { id: "path-b", title: "Reliable route", nodes: ["Project", "Topic", "Tool"], rationale: "Reliable", estimatedTokens: 150 },
];

const scenario: Scenario = {
  id: "test", title: "Test", category: "skill", task: "Summarize the topic", expected: "summary",
  paths: { "path-a": { success: false, result: "incomplete", tokens: 30, latencyMs: 20 }, "path-b": { success: true, result: "summary", tokens: 50, latencyMs: 40 } },
};

test("parses valid Agent candidates and rejects malformed output", () => {
  const parsed = parseAgentCandidates(JSON.stringify({ candidates }));
  assert.deepEqual(parsed.map((item) => item.id), ["path-a", "path-b"]);
  assert.throws(() => parseAgentCandidates("not json"), /JSON/);
  assert.throws(() => parseAgentCandidates(JSON.stringify({ candidates: [{ ...candidates[0], id: "" }] })), /candidate/i);
});

test("validates Jev decisions against this run candidate ids", () => {
  const result = parseJevDecision(JSON.stringify({ decisions: candidates.map((candidate, index) => ({ id: candidate.id, keep: index === 1, reason: "Task fit" })) }), candidates);
  assert.deepEqual(result.map((item) => item.keep), [false, true]);
  assert.throws(() => parseJevDecision(JSON.stringify({ decisions: [{ id: "unknown", keep: true, reason: "x" }] }), candidates), /unknown|match/i);
  assert.throws(() => parseJevDecision(JSON.stringify({ decisions: candidates.map((candidate) => ({ id: candidate.id, keep: true, reason: "x" })).concat({ id: "path-a", keep: false, reason: "duplicate" }) }), candidates), /duplicate/i);
  assert.throws(() => parseJevDecision(JSON.stringify({ decisions: candidates.map((candidate) => ({ id: candidate.id, keep: false, reason: "No fit" })) }), candidates), /at least one|keep/i);
});

test("paired experiment reuses one candidate set and executes all baseline paths but only Jev-kept paths", () => {
  const paired = runPairedExperiment({ candidates, decisions: [
    { id: "path-a", keep: false, reason: "Too shallow" },
    { id: "path-b", keep: true, reason: "Matches depth" },
  ], scenario, userTask: scenario.task });
  assert.deepEqual(paired.baseline.executedPathIds, ["path-a", "path-b"]);
  assert.deepEqual(paired.jev.executedPathIds, ["path-b"]);
  assert.equal(paired.baseline.result, paired.jev.result);
  assert.equal(paired.jev.executedTokens, 50);
});

test("reports Jev quality loss when it prunes the only successful candidate", () => {
  const paired = runPairedExperiment({ candidates, decisions: [
    { id: "path-a", keep: true, reason: "Keep" },
    { id: "path-b", keep: false, reason: "Pruned" },
  ], scenario, userTask: scenario.task });
  assert.equal(paired.baseline.success, true);
  assert.equal(paired.jev.success, false);
  assert.equal(paired.jev.error, "No retained path completed the task.");
});

