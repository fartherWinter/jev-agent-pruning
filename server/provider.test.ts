import test from "node:test";
import assert from "node:assert/strict";
import { createDeepSeekCaller } from "./provider.js";

test("sends a JSON-mode DeepSeek request and returns actual usage and model latency", async () => {
  let requestBody: Record<string, unknown> | undefined;
  let requestUrl = "";
  const caller = createDeepSeekCaller({ fetch: async (url, init) => {
    requestUrl = String(url);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      model: "deepseek-v4-flash", choices: [{ message: { content: "{\"candidates\":[]}" } }],
      usage: { prompt_tokens: 23, completion_tokens: 11, total_tokens: 34 },
    }), { status: 200 });
  }, apiKey: "test-key", baseUrl: "https://provider.test" });
  const result = await caller({ purpose: "agent", task: "task", category: "skill", model: "deepseek-v4-flash", candidateCatalog: [] });
  assert.equal(requestUrl, "https://provider.test/chat/completions");
  assert.equal((requestBody?.model), "deepseek-v4-flash");
  assert.deepEqual(requestBody?.response_format, { type: "json_object" });
  assert.deepEqual(result.usage, { promptTokens: 23, completionTokens: 11, totalTokens: 34 });
  assert.equal(result.model, "deepseek-v4-flash");
  assert.ok(result.latencyMs >= 0);
});

test("rejects provider responses without actual token usage", async () => {
  const caller = createDeepSeekCaller({ fetch: async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), { status: 200 }), apiKey: "test-key" });
  await assert.rejects(caller({ purpose: "agent", task: "task", category: "skill", model: "deepseek-v4-flash", candidateCatalog: [] }), /usage/i);
});

test("surfaces HTTP and malformed response errors", async () => {
  const unauthorized = createDeepSeekCaller({ fetch: async () => new Response(JSON.stringify({ error: { message: "Invalid API key" } }), { status: 401 }), apiKey: "test-key" });
  await assert.rejects(unauthorized({ purpose: "agent", task: "task", category: "skill", model: "deepseek-v4-flash", candidateCatalog: [] }), /Invalid API key/);
  const invalid = createDeepSeekCaller({ fetch: async () => new Response("not json", { status: 200 }), apiKey: "test-key" });
  await assert.rejects(invalid({ purpose: "agent", task: "task", category: "skill", model: "deepseek-v4-flash", candidateCatalog: [] }), /non-JSON/);
});

test("surfaces truncated JSON mode output instead of parsing partial content", async () => {
  const caller = createDeepSeekCaller({ fetch: async () => new Response(JSON.stringify({
    choices: [{ message: { content: "{\"candidates\":[" }, finish_reason: "length" }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }), { status: 200 }), apiKey: "test-key" });
  await assert.rejects(caller({ purpose: "agent", task: "task", category: "skill", model: "deepseek-v4-flash", candidateCatalog: [] }), /truncated/i);
});
