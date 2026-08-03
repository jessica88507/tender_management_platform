"use client";

import { useEffect, useRef, useState } from "react";
import { ChatCircleDots, PaperPlaneTilt, X } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";

type ChatMessage = { role: "user" | "assistant"; content: string };

const SUGGESTED_QUESTIONS = ["這個案子還剩幾天？", "有哪些任務還沒完成？", "主投標手是誰？", "有哪些案子快到期？"];

// The model often replies with markdown-style **bold** — render just that (not a full markdown
// parser) so it doesn't show up as literal asterisks in a plain-text chat bubble.
function renderWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
  );
}

// Positioned just below the alert bell (AlertBanner.tsx, `top-20 right-4.5`) so the two floating
// buttons stack vertically without overlapping, whether or not a case is currently open (this
// button is mounted at the AppShell level, unlike the bell which only renders inside CaseView).
export function AssistantChat() {
  const { activeId } = useApp();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const isComposing = useRef(false);

  const sendText = async (text: string) => {
    if (!text || sending) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, activeCaseId: activeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "詢問失敗，請稍後再試。");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "詢問失敗，請稍後再試。");
    } finally {
      setSending(false);
    }
  };

  const send = () => sendText(input.trim());

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="詢問系統助理"
        className="fixed top-36 right-4.5 z-40 w-12 h-12 rounded-full flex items-center justify-center border-2 bg-accent/10 border-accent shadow-[0_4px_14px_rgba(0,0,0,0.3)] cursor-pointer hover:brightness-95 transition-[filter] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <ChatCircleDots weight="fill" size={22} className="text-accent" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />
          <div className="fixed top-36 right-[76px] z-[999] bg-card border border-border rounded-[10px] shadow-[0_8px_24px_rgba(0,0,0,0.25)] w-[380px] max-w-[calc(100vw-100px)] h-[520px] max-h-[75vh] flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between py-3 px-4 border-b border-border">
              <div className="text-[16px] font-bold font-serif flex items-center gap-1.5">
                <ChatCircleDots weight="fill" size={16} className="text-accent" />
                系統助理
              </div>
              <button onClick={() => setOpen(false)} className="text-ink-soft hover:text-ink cursor-pointer" title="關閉">
                <X size={18} />
              </button>
            </div>
            <div className="shrink-0 px-4 pt-2.5 pb-2 text-[13px] text-ink-soft border-b border-dashed border-border">
              只能回答關於案件與排程的問題，不會、也無法幫你修改任何資料。
            </div>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
              {messages.length === 0 && (
                <div className="text-[14.5px] text-ink-soft text-center mt-6">點下面的常見問題，或直接輸入你的問題。</div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    "max-w-[85%] rounded-lg py-2 px-3 text-[15px] leading-relaxed whitespace-pre-wrap " +
                    (m.role === "user" ? "self-end bg-accent text-white" : "self-start bg-background text-ink")
                  }
                >
                  {renderWithBold(m.content)}
                </div>
              ))}
              {sending && (
                <div className="self-start bg-background text-ink-soft rounded-lg py-2 px-3 text-[15px]">思考中…</div>
              )}
              {error && <div className="self-start bg-danger-soft text-danger rounded-lg py-2 px-3 text-[14px]">{error}</div>}
            </div>
            <div className="shrink-0 flex flex-wrap gap-1.5 px-3 pt-2.5 border-t border-border">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendText(q)}
                  disabled={sending}
                  className="bg-accent/10 text-accent border border-accent/40 rounded-full py-1 px-2.5 text-[13px] cursor-pointer hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="shrink-0 flex items-end gap-2 p-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onCompositionStart={() => {
                  isComposing.current = true;
                }}
                onCompositionEnd={() => {
                  isComposing.current = false;
                }}
                onKeyDown={(e) => {
                  // Enter also confirms an in-progress CJK IME composition (choosing the intended
                  // characters from pinyin/zhuyin candidates) — without this guard, that confirming
                  // Enter press would submit the message before the user finished composing it.
                  if (e.key === "Enter" && !e.shiftKey && !isComposing.current && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="輸入你的問題…"
                rows={1}
                className="flex-1 resize-none py-2 px-2.5 border border-border rounded-md text-[15px] bg-card focus:outline-none focus:border-accent max-h-24"
              />
              <button
                onClick={send}
                disabled={sending || !input.trim()}
                title="送出"
                className="shrink-0 w-9 h-9 rounded-md bg-accent text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-95 transition-[filter] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <PaperPlaneTilt weight="fill" size={16} />
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
