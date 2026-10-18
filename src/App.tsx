import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bot, Check, ChevronDown,
  CircleAlert, CircleHelp, Clock3, Cpu, Database, FlaskConical, Gauge, GitBranch,
  Layers3, LoaderCircle, PanelLeftClose, Play, Scissors, Settings2, ShieldCheck,
  Sparkles, Wrench, X,
} from "lucide-react";
import type { BranchResult, Candidate, CandidateCategory, Decision, Scenario } from "./core.js";
import type { ExperimentRun } from "./experiment.js";

const categories: { id: CandidateCategory; label: string; icon: typeof Layers3; caption: string }[] = [
  { id: "skill", label: "Skill 路由", icon: Layers3, caption: "工作流能力" },
  { id: "model", label: "模型路由", icon: Cpu, caption: "推理能力" },
  { id: "tool", label: "工具路由", icon: Wrench, caption: "外部能力" },
];

const categoryCopy: Record<CandidateCategory, { title: string; subtitle: string }> = {
  skill: { title: "Skill 选择", subtitle: "Agent 在 Project 与 Topic 下组织 Skill 执行路径" },
  model: { title: "模型选择", subtitle: "比较不同推理能力与任务复杂度的匹配" },
  tool: { title: "工具选择", subtitle: "比较候选工具的上下文适配与执行成本" },
};

function formatNumber(value: number) { return new Intl.NumberFormat("en-US").format(value); }
function formatDuration(value: number) { return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`; }

function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CandidateCategory>("skill");
  const [selectedScenarioId, setSelectedScenarioId] = useState("skill-fit");
  const [task, setTask] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExperimentRun | null>(null);
  const [activeTab, setActiveTab] = useState<"comparison" | "reasoning">("comparison");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId);
  const currentTask = task || selectedScenario?.task || "";
  const displayTitle = selectedScenarioId === "custom" ? "自定义任务" : selectedScenario?.title || categoryCopy[selectedCategory].title;

  useEffect(() => {
    void Promise.all([
      fetch("/api/scenarios").then((response) => response.json()),
      fetch("/api/config").then((response) => response.json()),
    ]).then(([scenarioPayload, config]) => {
      setScenarios(scenarioPayload.scenarios);
      setModel(config.model);
      setHasApiKey(config.hasApiKey);
    }).catch(() => setError("无法连接本地 Demo 服务，请确认服务端已启动。"));
  }, []);

  const groupedScenarios = useMemo(() => scenarios.filter((scenario) => scenario.category === selectedCategory), [scenarios, selectedCategory]);

  function selectCategory(category: CandidateCategory) {
    setSelectedCategory(category);
    const firstScenario = scenarios.find((scenario) => scenario.category === category);
    setSelectedScenarioId(firstScenario?.id || "custom");
    setTask("");
    setResult(null);
    setError(null);
  }

  async function runExperiment() {
    if (!currentTask.trim()) { setError("先输入要运行的任务。"); return; }
    setRunning(true); setError(null); setResult(null); setActiveTab("comparison");
    try {
      const response = await fetch("/api/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId: selectedScenarioId, category: selectedCategory, task: currentTask }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "实验运行失败。");
      setResult(payload as ExperimentRun);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "实验运行失败。");
    } finally { setRunning(false); }
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark"><Scissors size={17} strokeWidth={2.2} /></div>
          {sidebarOpen && <div className="brand-word">jev<span>lab</span></div>}
          <button className="icon-button sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="切换侧边栏"><PanelLeftClose size={17} /></button>
        </div>

        <div className="workspace-select">
          <div className="workspace-avatar">J</div>
          {sidebarOpen && <><div className="workspace-copy"><strong>Jev Sandbox</strong><span>本地实验空间</span></div><ChevronDown size={15} className="muted-icon" /></>}
        </div>

        {sidebarOpen && <div className="side-section-label">实验类型</div>}
        <nav className="side-nav" aria-label="候选类型">
          {categories.map(({ id, label, icon: Icon, caption }) => (
            <button key={id} className={`nav-item ${selectedCategory === id ? "selected" : ""}`} onClick={() => selectCategory(id)} title={label}>
              <Icon size={17} strokeWidth={1.9} />
              {sidebarOpen && <><span className="nav-label">{label}</span><span className="nav-caption">{caption}</span></>}
            </button>
          ))}
        </nav>

        {sidebarOpen && <>
          <div className="side-section-heading"><span>场景库</span><span className="scenario-count">{groupedScenarios.length + 1}</span></div>
          <div className="scenario-list">
            {groupedScenarios.map((scenario, index) => (
              <button key={scenario.id} className={`scenario-link ${selectedScenarioId === scenario.id ? "active" : ""}`} onClick={() => { setSelectedScenarioId(scenario.id); setTask(""); setResult(null); setError(null); }}>
                <span className={`scenario-dot dot-${index + 1}`} />{scenario.title}
              </button>
            ))}
            <button className={`scenario-link ${selectedScenarioId === "custom" ? "active" : ""}`} onClick={() => { setSelectedScenarioId("custom"); setTask(""); setResult(null); setError(null); }}>
              <span className="scenario-plus">+</span>自定义任务
            </button>
          </div>
          <div className="sidebar-spacer" />
          <div className="sidebar-bottom-note"><Sparkles size={15} /><span>同一候选集 · 配对运行</span></div>
          <div className="profile-row"><div className="profile-avatar">C</div><div className="profile-name"><strong>本地研究者</strong><span>Demo 环境</span></div><Settings2 size={16} className="muted-icon" /></div>
        </>}
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>实验室</span><span className="crumb-slash">/</span><strong>{displayTitle}</strong></div>
          <div className="topbar-right"><span className={`connection-state ${hasApiKey ? "connected" : "missing"}`}><span className="connection-dot" />{hasApiKey ? "DeepSeek 已配置" : "待配置 API Key"}</span><span className="model-chip"><span className="model-glyph"><Bot size={13} /></span>{model}</span></div>
        </header>

        <div className="content-wrap">
          <section className="page-heading">
            <div><div className="heading-meta"><span>JEV + AGENT</span><span className="meta-divider" /><span>概念验证</span></div><h1>{categoryCopy[selectedCategory].title}剪枝</h1><p>{categoryCopy[selectedCategory].subtitle}</p></div>
            <div className="heading-right"><div className="experiment-state"><span className={`state-indicator ${result ? "complete" : "idle"}`} />{result ? "上次运行已完成" : "等待运行"}</div><div className="run-number">RUN <span>{result ? result.runId.slice(0, 8).toUpperCase() : "—"}</span></div></div>
          </section>

          <section className="setup-panel" aria-label="实验设置">
            <div className="setup-topline"><div className="setup-title"><span className="setup-icon"><FlaskConical size={16} /></span><div><h2>配置实验</h2><p>定义任务，再让 Agent 生成执行候选</p></div></div><div className="simulator-label"><Database size={14} />路径结果由本地模拟器评估</div></div>
            <div className="task-input-wrap">
              <label htmlFor="task-input">任务描述</label>
              <textarea id="task-input" rows={3} value={currentTask} onChange={(event) => { setTask(event.target.value); setSelectedScenarioId("custom"); setResult(null); }} placeholder="描述你希望 Agent 完成的任务…" />
              <span className="input-count">{currentTask.length} 字符</span>
            </div>
            <div className="setup-footer"><div className="selection-summary"><span className="selection-mark"><Check size={12} /></span><span>剪枝对象</span><strong>{categories.find((category) => category.id === selectedCategory)?.label}</strong><span className="summary-dot">·</span><span>候选集由 Agent 一次生成</span></div><button className="run-button" onClick={() => void runExperiment()} disabled={running || !currentTask.trim()}>{running ? <><LoaderCircle size={15} className="spin" />运行中…</> : <><Play size={14} fill="currentColor" />运行配对实验<ArrowRight size={15} /></>}</button></div>
          </section>

          {error && <div className="error-banner" role="alert"><CircleAlert size={17} /><div><strong>实验未完成</strong><span>{error}</span></div><button className="icon-button" onClick={() => setError(null)} aria-label="关闭错误"><X size={16} /></button></div>}

          <section className="method-strip" aria-label="实验流程">
            <div className="method-step"><span className="step-index">01</span><div className="step-icon agent-icon"><Bot size={16} /></div><div><strong>Agent 生成候选</strong><span>一次生成，共享给两组</span></div></div><ArrowRight size={15} className="method-arrow" />
            <div className="method-step"><span className="step-index">02</span><div className="step-icon jev-icon"><Scissors size={15} /></div><div><strong>Jev 判断并剪枝</strong><span>逐条给出保留依据</span></div></div><ArrowRight size={15} className="method-arrow" />
            <div className="method-step"><span className="step-index">03</span><div className="step-icon sim-icon"><Activity size={16} /></div><div><strong>本地路径模拟</strong><span>按候选顺序执行</span></div></div>
          </section>

          {result ? <ResultSection result={result} activeTab={activeTab} setActiveTab={setActiveTab} /> : <EmptyResults running={running} />}
          <footer className="page-footer"><span>Jev Lab <span className="footer-dot">·</span> Prototype 0.1</span><span><ShieldCheck size={13} />API Key 仅在服务端使用</span></footer>
        </div>
      </main>
    </div>
  );
}

function EmptyResults({ running }: { running: boolean }) {
  return <section className={`empty-results ${running ? "is-running" : ""}`}>
    <div className="empty-graphic"><div className="empty-orbit orbit-outer" /><div className="empty-orbit orbit-inner" /><div className="empty-center"><GitBranch size={24} strokeWidth={1.6} /></div><span className="orbit-node node-top"><Bot size={13} /></span><span className="orbit-node node-left"><Scissors size={12} /></span><span className="orbit-node node-right"><Activity size={13} /></span></div>
    <h2>{running ? "正在构建配对实验" : "运行一次，观察剪枝如何改变路径"}</h2>
    <p>{running ? "Agent 正在生成候选，随后 Jev 会对同一组路径作出判断。" : "结果将并列呈现完整候选执行与 Jev 保留路径的任务表现、Token 和延迟。"}</p>
    <div className="empty-legend"><span><i className="legend-dot baseline-dot" />关闭 Jev · 执行全部候选</span><span><i className="legend-dot jev-dot" />开启 Jev · 执行保留路径</span></div>
  </section>;
}

function ResultSection({ result, activeTab, setActiveTab }: { result: ExperimentRun; activeTab: "comparison" | "reasoning"; setActiveTab: (tab: "comparison" | "reasoning") => void }) {
  const keptCount = result.decisions.filter((decision) => decision.keep).length;
  const tokenSaved = result.baseline.executedTokens - result.jev.executedTokens;
  const latencySaved = result.baseline.executionLatencyMs - result.jev.executionLatencyMs;
  return <section className="results-section">
    <div className="results-top"><div><div className="results-title-row"><h2>实验结果</h2><span className="result-badge"><Check size={12} />已完成</span></div><p>Agent 生成 {result.candidates.length} 条候选，Jev 保留 {keptCount} 条路径</p></div><div className="result-tabs"><button className={activeTab === "comparison" ? "active" : ""} onClick={() => setActiveTab("comparison")}>A/B 对照</button><button className={activeTab === "reasoning" ? "active" : ""} onClick={() => setActiveTab("reasoning")}>剪枝依据</button></div></div>
    <div className="metric-ribbon">
      <div className="metric-cell"><span>Agent 候选生成</span><strong>{formatNumber(result.metrics.agent.totalTokens)}<small> tokens</small></strong><em><Clock3 size={12} />{formatDuration(result.metrics.agent.latencyMs)}</em></div>
      <div className="metric-cell"><span>Jev 裁判开销</span><strong>{formatNumber(result.metrics.jev.totalTokens)}<small> tokens</small></strong><em><Clock3 size={12} />{formatDuration(result.metrics.jev.latencyMs)}</em></div>
      <div className="metric-cell highlight-metric"><span>执行 Token 减少</span><strong>{tokenSaved > 0 ? `−${formatNumber(tokenSaved)}` : formatNumber(tokenSaved)}<small> tokens</small></strong><em>{tokenSaved > 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{tokenSaved > 0 ? "相对基线" : "相对基线"}</em></div>
      <div className="metric-cell"><span>端到端总耗时</span><strong>{formatDuration(result.metrics.endToEndLatencyMs)}</strong><em><Gauge size={12} />含两次模型调用</em></div>
    </div>
    {result.evaluation === "keyword-simulation" && <div className="simulation-notice"><CircleHelp size={14} />自定义任务的结果由本地关键词模拟器评估，仅用于探索流程，不代表真实任务质量。</div>}
    {activeTab === "comparison" ? <div className="comparison-grid"><BranchPanel mode="baseline" branch={result.baseline} result={result} /><BranchPanel mode="jev" branch={result.jev} result={result} /></div> : <ReasoningPanel candidates={result.candidates} decisions={result.decisions} />}
    <div className="experiment-footnote"><span>候选生成开销为两组共享开销。</span><span>模拟执行 Token 与延迟为预设估算值。</span>{latencySaved !== 0 && <span>模拟执行时长差：{latencySaved > 0 ? "−" : "+"}{formatDuration(Math.abs(latencySaved))}</span>}</div>
  </section>;
}

function BranchPanel({ mode, branch, result }: { mode: "baseline" | "jev"; branch: BranchResult; result: ExperimentRun }) {
  const isJev = mode === "jev";
  const decisions = new Map(result.decisions.map((decision) => [decision.id, decision]));
  return <article className={`branch-panel ${isJev ? "jev-branch" : "baseline-branch"}`}>
    <header className="branch-header"><div className={`branch-symbol ${isJev ? "jev-symbol" : "base-symbol"}`}>{isJev ? <Scissors size={15} /> : <Layers3 size={15} />}</div><div><h3>{isJev ? "Jev 开启" : "Jev 关闭"}</h3><span>{isJev ? "裁判剪枝后执行" : "Agent 排序 · 完整执行"}</span></div><span className={`branch-outcome ${branch.success ? "success" : "failed"}`}>{branch.success ? <><Check size={12} />任务成功</> : <><X size={12} />未完成</>}</span></header>
    <div className="path-list">{result.candidates.map((candidate, index) => {
      const decision = decisions.get(candidate.id);
      const executed = branch.executedPathIds.includes(candidate.id);
      const pruned = isJev && !decision?.keep;
      const winner = branch.successPathId === candidate.id;
      return <div key={candidate.id} className={`path-row ${pruned ? "pruned" : ""} ${winner ? "winner" : ""}`}>
        <div className="path-index">{String(index + 1).padStart(2, "0")}</div><div className="path-content"><div className="path-title-row"><strong>{candidate.title}</strong>{winner && <span className="winner-tag">命中</span>}{pruned && <span className="pruned-tag">已剪枝</span>}</div><div className="path-nodes">{candidate.nodes.map((node, nodeIndex) => <span key={`${node}-${nodeIndex}`}>{nodeIndex > 0 && <i>›</i>}{node.split(": ").pop()}</span>)}</div>{isJev && decision && <div className={`path-reason ${decision.keep ? "kept-reason" : "pruned-reason"}`}>{decision.keep ? <Check size={12} /> : <X size={12} />}{decision.reason}</div>}{!isJev && <div className="agent-rationale">Agent · {candidate.rationale}</div>}</div><div className="path-state">{pruned ? <span className="state-pruned">排除</span> : executed ? <span className="state-executed">执行</span> : <span className="state-pending">待执行</span>}</div>
      </div>;
    })}</div>
    <div className={`branch-result ${branch.success ? "" : "result-failed"}`}><div className="branch-result-icon">{branch.success ? <Check size={15} /> : <CircleAlert size={15} />}</div><div className="branch-result-copy"><span>{branch.success ? "模拟任务结果" : "任务未完成"}</span><p>{branch.result}</p></div></div>
    <footer className="branch-metrics"><div><span>本支总 Token</span><strong>{formatNumber(isJev ? result.metrics.jevTotalTokens : result.metrics.baselineTotalTokens)}</strong></div><div><span>路径执行 Token</span><strong>{formatNumber(branch.executedTokens)}</strong></div><div><span>本支总耗时</span><strong>{formatDuration(isJev ? result.metrics.jevTotalLatencyMs : result.metrics.baselineTotalLatencyMs)}</strong></div><div><span>执行路径</span><strong>{branch.executedPathIds.length} / {result.candidates.length}</strong></div></footer>
  </article>;
}

function ReasoningPanel({ candidates, decisions }: { candidates: Candidate[]; decisions: Decision[] }) {
  const decisionMap = new Map(decisions.map((decision) => [decision.id, decision]));
  return <div className="reasoning-list">{candidates.map((candidate, index) => {
    const decision = decisionMap.get(candidate.id)!;
    return <article className={`reasoning-row ${decision.keep ? "reasoning-kept" : "reasoning-pruned"}`} key={candidate.id}>
      <span className="reasoning-number">{String(index + 1).padStart(2, "0")}</span><div className="reasoning-main"><div className="reasoning-heading"><h3>{candidate.title}</h3><span className={`decision-pill ${decision.keep ? "keep-pill" : "prune-pill"}`}>{decision.keep ? <><Check size={12} />保留</> : <><X size={12} />排除</>}</span></div><div className="reasoning-path">{candidate.nodes.map((node, nodeIndex) => <span key={node}>{nodeIndex > 0 && <ArrowRight size={11} />}{node}</span>)}</div><div className="reasoning-copy"><span>Agent</span><p>{candidate.rationale}</p></div><div className={`reasoning-copy judge-copy ${decision.keep ? "" : "judge-pruned"}`}><span>Jev</span><p>{decision.reason}</p></div></div>
    </article>;
  })}</div>;
}

export default App;
