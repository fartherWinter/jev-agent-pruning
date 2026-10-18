import test from "node:test";
import assert from "node:assert/strict";
import { runExperiment, type ModelCompletion } from "./experiment.js";
import { scenarios } from "../server/scenarios.js";

const agentPayload = JSON.stringify({ candidates: [
  { id: "skill-general", title: "General help", nodes: ["Project", "Topic", "General skill"], rationale: "Broad fit" },
  { id: "skill-structured", title: "Structured research", nodes: ["Project", "Topic", "Research skill"], rationale: "Matches required depth" },
  { id: "skill-research", title: "Research only", nodes: ["Project", "Topic", "Research", "Citations"], rationale: "Adds sourcing" },
] });
const judgePayload = JSON.stringify({ decisions: [
  { id: "skill-general", keep: false, reason: "Too broad" },
  { id: "skill-structured", keep: true, reason: "Matches the task" },
  { id: "skill-research", keep: false, reason: "Unnecessary" },
] });

test("runs candidate generation once and uses that exact list for judging and paired execution", async () => {
  const calls: string[] = [];
  const complete = async (input: { purpose: "agent" | "jev" }): Promise<ModelCompletion> => {
    calls.push(input.purpose);
    return {
      content: input.purpose === "agent" ? agentPayload : judgePayload,
      model: "deepseek-v4-flash",
      usage: { promptTokens: 300, completionTokens: 120, totalTokens: 420 },
      latencyMs: 12,
    };
  };
  const run = await runExperiment({ scenario: scenarios[0]!, task: scenarios[0]!.task, model: "deepseek-v4-flash", complete });
  assert.deepEqual(calls, ["agent", "jev"]);
  assert.deepEqual(run.baseline.executedPathIds, run.candidates.map((candidate) => candidate.id));
  assert.deepEqual(run.jev.executedPathIds, ["skill-structured"]);
  assert.equal(run.metrics.agent.totalTokens, 420);
  assert.equal(run.metrics.jev.totalTokens, 420);
});

test("surfaces provider failures without returning baseline-only output", async () => {
  let calls = 0;
  await assert.rejects(runExperiment({
    scenario: scenarios[0]!, task: scenarios[0]!.task, model: "deepseek-v4-flash",
    complete: async () => { calls += 1; throw new Error("DeepSeek unavailable"); },
  }), /DeepSeek unavailable/);
  assert.equal(calls, 1);
});
