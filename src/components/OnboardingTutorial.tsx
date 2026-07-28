"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CaretDown, CaretUp, X } from "@phosphor-icons/react";

const DISMISS_KEY = "bid-scheduler-onboarding-dismissed";

export function isOnboardingDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function setOnboardingDismissed(value: boolean) {
  try {
    if (value) window.localStorage.setItem(DISMISS_KEY, "1");
    else window.localStorage.removeItem(DISMISS_KEY);
  } catch {
    // ignore storage errors
  }
}

type Step = { selector: string; title: string; body: string };

// Each selector targets a real `data-tutorial="..."` attribute already present on the actual UI
// element (see CaseHeader/InfoPanel/TeamPanel/CaseView) — the tour spotlights the live feature
// itself rather than describing it in a floating dialog.
const STEPS: Step[] = [
  {
    selector: '[data-tutorial="case-header"]',
    title: "歡迎使用業務投標管理平台",
    body: "這裡是案件名稱與投標倒數天數。接下來用 4 個步驟帶你認識開案後該做的事，隨時可以按右上角關閉跳過。",
  },
  {
    selector: '[data-tutorial="info-panel"]',
    title: "第一步：填寫案件資訊",
    body: "在「案件資訊」填入招標公告時間、投標截止、契約金額等欄位，系統會依此自動產生完整排程任務清單。",
  },
  {
    selector: '[data-tutorial="team-panel"]',
    title: "第二步：建立備標團隊",
    body: "在「備標團隊成員」加入建築師、機電團隊與各專業顧問，之後指派任務負責人時就能直接選取。",
  },
  {
    selector: '[data-tutorial="schedule-toggle"]',
    title: "第三步：管理時程",
    body: "切換「行事曆檢視」「任務清單」或「兩者檢視」來管理所有排程任務——勾選完成、標記大事記（★）、連結任務自動跟隨日期，或直接拖曳事件改期。",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

export function OnboardingTutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const last = step === STEPS.length - 1;
  const current = STEPS[step];

  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const el = document.querySelector(current.selector);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [current.selector]);

  useEffect(() => {
    // Instant (not smooth) scroll — a smooth-scroll animation can still be mid-flight when the
    // measurement timer below fires for a long jump, capturing a stale rect and spotlighting the
    // wrong section. An instant jump has no such race.
    const el = document.querySelector(current.selector);
    el?.scrollIntoView({ behavior: "auto", block: "center" });
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
  }, [current.selector, measure]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure]);

  const handleClose = () => {
    if (dontShowAgain) setOnboardingDismissed(true);
    onClose();
  };

  const pad = 8;
  const calloutW = 360;
  const showBelow = rect ? rect.top + rect.height + 240 < viewport.h : true;
  const calloutLeft = rect ? Math.min(Math.max(rect.left, 12), viewport.w - calloutW - 12) : viewport.w / 2 - calloutW / 2;
  const calloutTop = rect
    ? showBelow
      ? rect.top + rect.height + pad + 16
      : Math.max(rect.top - pad - 16 - 230, 12)
    : viewport.h * 0.4;
  const arrowLeft = rect ? Math.min(Math.max(rect.left, 12) + 24, viewport.w - 36) - calloutLeft : 24;

  return (
    <div className="fixed inset-0 z-[1000]">
      {/* Dark mask with a see-through "spotlight" cut exactly around the highlighted element —
          a small bordered box positioned over the target, with a huge box-shadow filling
          everywhere else, instead of an SVG mask. */}
      {rect ? (
        <div
          className="fixed rounded-lg border-2 pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(4,10,18,0.75)",
            borderColor: "var(--color-primary)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(4,10,18,0.75)]" />
      )}

      <button
        onClick={handleClose}
        title="關閉新手教學"
        className="fixed top-4 right-4 z-[1002] w-10 h-10 rounded-full bg-card border-2 border-primary text-ink flex items-center justify-center cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shadow-[0_4px_14px_rgba(0,0,0,0.3)]"
      >
        <X weight="bold" size={18} />
      </button>

      <div
        className="fixed z-[1001] transition-all duration-300 ease-out"
        style={{ top: calloutTop, left: calloutLeft, width: calloutW, maxWidth: "92vw" }}
      >
        <div className="relative bg-card border-2 border-primary rounded-lg p-4 shadow-[0_8px_28px_rgba(0,0,0,0.4)]">
          {rect && (
            <span
              className={
                "absolute w-3.5 h-3.5 bg-card rotate-45 " +
                (showBelow ? "-top-[8px] border-l-2 border-t-2 border-primary" : "-bottom-[8px] border-r-2 border-b-2 border-primary")
              }
              style={{ left: Math.max(16, Math.min(arrowLeft, calloutW - 32)) }}
            />
          )}
          <div className="flex items-center gap-1.5 text-primary font-bold text-[13px] font-mono tracking-[0.15em] uppercase mb-1.5">
            {showBelow ? <CaretUp weight="bold" size={13} /> : <CaretDown weight="bold" size={13} />}
            步驟 {step + 1} / {STEPS.length}
          </div>
          <h3 className="font-serif font-bold text-[20px] text-ink mb-1.5">{current.title}</h3>
          <p className="text-[15.5px] text-ink-soft leading-relaxed mb-3.5">{current.body}</p>

          <div className="flex items-center gap-1 mb-3.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={"h-1.5 rounded-full transition-all " + (i === step ? "w-5 bg-primary" : "w-1.5 bg-border")}
              />
            ))}
          </div>

          {last && (
            <label className="flex items-center gap-2 text-[14px] text-ink-soft mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-3.5 h-3.5 cursor-pointer accent-primary"
              />
              下次新增案件時不再自動顯示
            </label>
          )}

          <div className="flex items-center justify-between gap-2">
            <button onClick={handleClose} className="text-[14.5px] text-ink-soft hover:text-ink cursor-pointer font-bold">
              跳過
            </button>
            <div className="flex gap-1.5">
              {step > 0 && (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1 border border-border text-ink-soft py-1.5 px-2.5 rounded text-[14.5px] font-bold cursor-pointer hover:bg-muted"
                >
                  <ArrowLeft weight="bold" size={12} />
                  上一步
                </button>
              )}
              <button
                onClick={() => (last ? handleClose() : setStep((s) => s + 1))}
                className="flex items-center gap-1 bg-primary text-white py-1.5 px-2.5 rounded text-[14.5px] font-bold cursor-pointer hover:bg-primary-dark"
              >
                {last ? "開始使用" : "下一步"}
                {!last && <ArrowRight weight="bold" size={12} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
