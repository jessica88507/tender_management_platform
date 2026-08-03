import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { rowToCase } from "@/lib/caseMapper";
import { buildAllCasesSummary, buildCaseContext } from "@/lib/assistantContext";
import type { AppState } from "@/lib/types";

// This assistant answers questions about the user's own bid-scheduling data — it does not, and
// must not, perform any action (create/edit/delete a case, move a task, etc.). It's read-only by
// construction: the system prompt below is the only thing telling the model that, so it must stay
// explicit and be repeated if the prompt is ever changed, not left implicit.

const MAX_HISTORY = 20;

// Local self-hosted model reached through a Cloudflare Tunnel (see docs/DECISIONS.md) — no
// per-request API cost, but genuinely slower than a hosted API and dependent on the user's own
// machine being on and reachable. Matches extract-tender/route.ts's cap: this project's Hobby plan
// has Fluid Compute enabled, which raises Vercel's own ceiling to 300s, so there's no reason to
// leave a tighter, arbitrary limit in place — a cold model reload (Ollama unloads after idling)
// plus a large case's task list could plausibly need more than 60s on a bad day.
export const maxDuration = 300;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const llmUrl = process.env.LOCAL_LLM_URL;
  const llmSecret = process.env.LOCAL_LLM_SECRET;
  if (!llmUrl || !llmSecret) {
    return NextResponse.json({ error: "尚未設定本機語言模型的連線資訊（LOCAL_LLM_URL / LOCAL_LLM_SECRET）。" }, { status: 503 });
  }

  const body = (await request.json()) as { messages?: ChatMessage[]; activeCaseId?: string };
  const messages = (body.messages ?? []).slice(-MAX_HISTORY);
  if (messages.length === 0) {
    return NextResponse.json({ error: "沒有收到任何訊息" }, { status: 400 });
  }

  const dbStart = Date.now();
  const rows = await db.query.cases.findMany({
    with: { tasks: true, teamMembers: true, consultants: true, weekNotes: true },
  });
  const dbSec = (Date.now() - dbStart) / 1000;
  const state: AppState = { cases: {}, lastActiveId: null };
  rows.forEach((row) => {
    state.cases[row.id] = rowToCase(row);
  });

  const activeCase = body.activeCaseId ? state.cases[body.activeCaseId] : null;
  const contextBlock = activeCase
    ? [
        "以下是使用者目前正在檢視的案件資料：",
        buildCaseContext(activeCase),
        "",
        "系統中其他案件（僅列出名稱/主投標手/投標截止/剩餘天數）：",
        buildAllCasesSummary(state, body.activeCaseId),
      ].join("\n")
    : ["使用者目前沒有開啟任何特定案件。系統中所有案件如下：", buildAllCasesSummary(state)].join("\n");

  // Without an explicit "today" anchor, the model sometimes tries to re-derive day counts itself
  // from the raw deadline string instead of trusting the number already computed below (with the
  // same caseDaysLeft() the UI itself uses) — and gets it wrong, since it has no reliable notion of
  // "today" on its own. Telling it the real date and explicitly forbidding recomputation fixes the
  // mismatch reported between the UI's day count and the assistant's answer.
  const todayIso = new Date().toISOString().slice(0, 10);
  const systemPrompt = [
    "你是「業務投標管理平台 Bigmaster」系統內建的問答助理，協助業務部同仁查詢招標／投標案件的排程與資料。",
    `今天的日期是 ${todayIso}。`,
    "你只能根據下面提供的案件資料回答問題，不知道的事情要直接說不知道，不可以編造。",
    "非常重要：下面案件資料裡「距離投標截止還有 N 天」「剩餘 N 天」這類天數都已經算好了，回答時直接引用這個數字即可，絕對不要自己用日期重新計算天數——你自己算很容易算錯。",
    "非常重要：你沒有能力、也絕對不可以宣稱自己新增、修改、刪除了任何案件、任務或欄位——你只能回答問題，所有實際操作都必須由使用者自己在畫面上完成。如果使用者要求你「幫他做」什麼事，要清楚說明你只能提供資訊，無法代為操作，並告訴他應該去畫面上哪裡自己動手。",
    "回答請使用繁體中文，簡潔扼要。",
    "",
    contextBlock,
  ].join("\n");

  try {
    const upstream = await fetch(`${llmUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${llmSecret}` },
      body: JSON.stringify({
        model: "qwen2.5:14b",
        stream: false,
        options: { num_ctx: 8192 },
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      throw new Error(`本機模型回應失敗（${upstream.status}）：${text.slice(0, 300)}`);
    }
    const data = (await upstream.json()) as {
      message?: { content?: string };
      total_duration?: number;
      load_duration?: number;
      prompt_eval_count?: number;
      prompt_eval_duration?: number;
      eval_count?: number;
      eval_duration?: number;
    };
    const reply = data.message?.content?.trim();
    if (!reply) throw new Error("本機模型沒有回傳任何內容");

    // Ollama reports its own internal breakdown in nanoseconds — converted to seconds here so it's
    // directly readable. `loadSec` is the tell for "the model had been idle and had to reload into
    // memory" (Ollama unloads an idle model after a few minutes) vs. a already-warm model, which is
    // usually the single biggest, most avoidable chunk of a slow response when it's non-trivial.
    const ns = (n: number | undefined) => (typeof n === "number" ? Math.round(n / 1e6) / 1000 : null);
    const timing = {
      dbSec: Math.round(dbSec * 1000) / 1000,
      totalSec: ns(data.total_duration),
      loadSec: ns(data.load_duration),
      promptEvalSec: ns(data.prompt_eval_duration),
      evalSec: ns(data.eval_duration),
      promptTokens: data.prompt_eval_count ?? null,
      evalTokens: data.eval_count ?? null,
    };
    console.log("[assistant/chat] timing:", timing);

    return NextResponse.json({ reply, timing });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `詢問失敗：${message}` }, { status: 502 });
  }
}
