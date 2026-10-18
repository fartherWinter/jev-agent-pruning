import type { Candidate, CandidateCategory, Scenario } from "../src/core.js";

const catalogs: Record<CandidateCategory, Candidate[]> = {
  skill: [
    { id: "skill-general", title: "通用助理路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Skill: General assistant"], rationale: "" },
    { id: "skill-structured", title: "结构化研究路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Skill: Market research", "Skill: Evidence synthesis"], rationale: "" },
    { id: "skill-research", title: "深度调研路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Skill: Web research", "Skill: Citation audit"], rationale: "" },
  ],
  model: [
    { id: "model-fast", title: "轻量模型路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Model: Fast response"], rationale: "" },
    { id: "model-balanced", title: "均衡模型路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Model: Balanced analysis"], rationale: "" },
    { id: "model-reasoning", title: "推理模型路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Model: Deep reasoning"], rationale: "" },
  ],
  tool: [
    { id: "tool-search", title: "网页检索路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Tool: Web search"], rationale: "" },
    { id: "tool-catalog", title: "内部目录路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Tool: Product catalog", "Skill: Evidence synthesis"], rationale: "" },
    { id: "tool-browser", title: "浏览器采集路径", nodes: ["Project: Research desk", "Topic: Product analysis", "Tool: Browser automation"], rationale: "" },
  ],
};

export const scenarios: Scenario[] = [
  {
    id: "skill-fit", title: "Skill 选择", category: "skill",
    task: "为采购团队比较三个协作产品，整理一份有证据支撑的决策简报。",
    expected: "包含明确维度、证据和建议的产品决策简报。", catalog: catalogs.skill,
    paths: {
      "skill-general": { success: false, result: "生成了通用概览，缺少比较依据。", tokens: 540, latencyMs: 820, successKeywords: ["通用概览"] },
      "skill-structured": { success: true, result: "按维度比较产品，归纳证据并给出采购建议。", tokens: 760, latencyMs: 1180, successKeywords: ["比较", "产品"] },
      "skill-research": { success: true, result: "完成对比，整理来源并附上引用审查。", tokens: 1100, latencyMs: 1710, successKeywords: ["来源", "引用", "研究"] },
    },
  },
  {
    id: "model-fit", title: "模型选择", category: "model",
    task: "读取一份较长的产品反馈，归纳主要主题并提出有优先级的行动建议。",
    expected: "覆盖主要反馈主题并附带可执行优先级。", catalog: catalogs.model,
    paths: {
      "model-fast": { success: false, result: "输出了简短摘要，但行动项缺少排序依据。", tokens: 410, latencyMs: 560, successKeywords: ["摘要"] },
      "model-balanced": { success: true, result: "聚合反馈主题，按影响和紧迫度排序行动项。", tokens: 820, latencyMs: 1260, successKeywords: ["主题", "排序"] },
      "model-reasoning": { success: true, result: "给出主题分析、优先级解释与行动建议。", tokens: 1230, latencyMs: 2040, successKeywords: ["主题", "建议"] },
    },
  },
  {
    id: "tool-fit", title: "工具选择", category: "tool",
    task: "从现有的内部产品目录中核对三款产品的支持范围与集成方式。",
    expected: "产品属性与集成信息均来自目录核对。", catalog: catalogs.tool,
    paths: {
      "tool-search": { success: false, result: "网页结果混入了过期的产品版本信息。", tokens: 680, latencyMs: 1460, successKeywords: ["搜索"] },
      "tool-catalog": { success: true, result: "逐项核对目录属性和集成说明，结果与当前产品记录一致。", tokens: 520, latencyMs: 930, successKeywords: ["目录", "核对", "内部"] },
      "tool-browser": { success: true, result: "浏览产品页面并整理了当前支持范围与集成说明。", tokens: 870, latencyMs: 1820, successKeywords: ["浏览器", "网页"] },
    },
  },
];

export function getScenario(scenarioId: string, category: CandidateCategory, task?: string): Scenario {
  if (scenarioId !== "custom") {
    const scenario = scenarios.find((item) => item.id === scenarioId);
    if (!scenario) throw new Error("Unknown scenario.");
    return { ...scenario, task: task?.trim() || scenario.task };
  }
  const catalog = catalogs[category];
  return {
    id: "custom", title: "自定义任务", category,
    task: task?.trim() ?? "",
    expected: "由本地关键词模拟器根据路径能力进行判断。",
    catalog,
    paths: Object.fromEntries(catalog.map((candidate) => [candidate.id, {
      success: false,
      result: `${candidate.title}：本地模拟完成。`,
      tokens: category === "model" ? 800 : 600,
      latencyMs: category === "model" ? 1250 : 900,
      successKeywords: candidate.id === "tool-catalog" ? ["目录", "内部", "核对"]
        : candidate.id === "tool-search" ? ["搜索", "网页", "来源"]
          : candidate.id === "tool-browser" ? ["浏览器", "网页"]
            : candidate.id === "model-fast" ? ["摘要", "简单"]
              : candidate.id === "model-balanced" ? ["归纳", "主题", "比较"]
                : candidate.id === "model-reasoning" ? ["推理", "复杂", "优先级"]
                  : candidate.id === "skill-general" ? ["通用", "简单"]
                    : candidate.id === "skill-structured" ? ["比较", "简报", "归纳"]
                      : ["研究", "引用", "来源"],
    }])) as Scenario["paths"],
  };
}
