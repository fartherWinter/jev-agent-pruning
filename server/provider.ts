import type { Candidate, CandidateCategory } from "../src/core.js";
import type { ModelCaller, ModelCompletion } from "../src/experiment.js";

const BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

interface DeepSeekResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string | null }>;
  model?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function formatCatalog(catalog: Candidate[]): string {
  return catalog.map((candidate) => `${candidate.id}: ${candidate.title} | ${candidate.nodes.join(" > ")}`).join("\n");
}

function systemPrompt(purpose: "agent" | "jev", category: CandidateCategory): string {
  if (purpose === "agent") {
    return `你是一个 Agent 路径规划器。当前候选类型是 ${category}。为用户任务从给定候选目录中选择 3 条有差异的执行路径，返回严格 JSON，不要 Markdown：{"candidates":[{"id":"目录中的id","title":"路径名称","nodes":["Project...","Topic...","Skill/Model/Tool..."],"rationale":"为什么适合","estimatedTokens":123}]}。只能使用目录中的 id，必须覆盖 Project、Topic 和该类型节点。`;
  }
  return `你是 Jev 剪枝裁判。判断每条候选路径是否值得保留，重点考虑任务匹配、预期结果质量、重复工作和执行成本。返回严格 JSON，不要 Markdown：{"decisions":[{"id":"候选id","keep":true,"reason":"简短、具体的判断依据"}]}。必须逐条返回所有候选 id，至少保留一条，不能改写 id。`;
}

export function createDeepSeekCaller(options: { fetch?: typeof fetch; apiKey?: string; baseUrl?: string } = {}): ModelCaller {
  return async (input): Promise<ModelCompletion> => {
    const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured on the server.");
    const body = {
      model: input.model,
      temperature: input.purpose === "agent" ? 0.2 : 0,
      max_tokens: 1400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${systemPrompt(input.purpose, input.category)}\n严格输出合法 json。` },
        { role: "user", content: input.purpose === "agent"
          ? `任务：${input.task}\n候选目录：\n${formatCatalog(input.candidateCatalog)}`
          : `任务：${input.task}\n候选路径：\n${formatCatalog(input.candidates ?? [])}` },
      ],
    };
    const startedAt = performance.now();
      const response = await (options.fetch ?? fetch)(`${options.baseUrl ?? BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    const raw = await response.text();
    const latencyMs = Math.round(performance.now() - startedAt);
    let parsed: DeepSeekResponse | { error?: { message?: string } };
    try { parsed = JSON.parse(raw) as DeepSeekResponse; } catch { throw new Error(`DeepSeek returned a non-JSON response (${response.status}).`); }
    if (!response.ok) throw new Error((parsed as { error?: { message?: string } }).error?.message || `DeepSeek request failed (${response.status}).`);
    const completion = parsed as DeepSeekResponse;
    if (completion.choices?.[0]?.finish_reason === "length") throw new Error("DeepSeek truncated the JSON response at the token limit. Increase max_tokens or simplify the task.");
    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek returned no completion content.");
    if (!completion.usage || typeof completion.usage.prompt_tokens !== "number" || typeof completion.usage.completion_tokens !== "number") {
      throw new Error("DeepSeek response is missing actual token usage.");
    }
    const promptTokens = completion.usage.prompt_tokens;
    const completionTokens = completion.usage.completion_tokens;
    return {
      content,
      model: completion.model || input.model,
      usage: { promptTokens, completionTokens, totalTokens: completion.usage?.total_tokens ?? promptTokens + completionTokens },
      latencyMs,
    };
  };
}
