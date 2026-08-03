import type { AppState, Case } from "./types";
import { caseDaysLeft, caseProgress } from "./derived";

// Compact text summary (not raw JSON) of one case, fed to the local LLM as grounding context for
// the Q&A assistant — plain sentences read far more reliably for a 14B model than a large nested
// JSON blob, and cost fewer tokens than pretty-printed JSON would for the same information.
export function buildCaseContext(c: Case): string {
  const days = caseDaysLeft(c);
  const { doneCount, total, pct } = caseProgress(c);
  const teamNames = [
    c.team.architectName || "建築師團隊（尚未命名）",
    "建國工程團隊",
    ...(c.team.extraName ? [c.team.extraName] : []),
  ].join("、");

  const taskLines = c.tasks
    .slice()
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((t) => `- [${t.done ? "x" : " "}] ${t.due} ${t.label}（分類：${t.cat}${t.milestone ? "，大事記" : ""}）`)
    .join("\n");

  return [
    `案件名稱：${c.name}`,
    `主投標手：${c.bidLead || "尚未指定"}`,
    `招標公告：${c.start}｜投標截止：${c.deadline.replace("T", " ")}｜距離投標截止還有 ${days} 天`,
    `契約金額：${c.contractAmount ? c.contractAmount.toLocaleString() : "尚未填寫"}`,
    `業主：${c.ownerOrg || "—"}｜使用單位：${c.userUnit || "—"}｜地點：${c.location || "—"}`,
    `標案形式：${c.tenderType || "—"}｜契約模式：${c.contractMode || "—"}`,
    `備標團隊：${teamNames}`,
    `整體進度：${doneCount} / ${total} 項已完成（${pct}%）`,
    `任務清單（共 ${c.tasks.length} 項，格式為 [完成狀態] 日期 任務名稱）：`,
    taskLines || "（目前沒有任務）",
  ].join("\n");
}

// Lightweight cross-case awareness (name/deadline/days-left only, no task-level detail) so the
// assistant can answer things like "我還有哪些案子快到期" without every case's full task list
// blowing up the context window.
export function buildAllCasesSummary(state: AppState, excludeId?: string): string {
  const rows = Object.entries(state.cases)
    .filter(([id]) => id !== excludeId)
    .map(([, c]) => `- ${c.name}（主投標手：${c.bidLead || "—"}，投標截止：${c.deadline.replace("T", " ")}，剩餘 ${caseDaysLeft(c)} 天）`);
  if (rows.length === 0) return "（系統中沒有其他案件）";
  return rows.join("\n");
}
