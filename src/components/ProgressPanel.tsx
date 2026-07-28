"use client";

import { ChartBar } from "@phosphor-icons/react";
import { Case } from "@/lib/types";
import { MILESTONE_ORDER } from "@/lib/constants";
import { caseProgress } from "@/lib/derived";
import { daysBetween } from "@/lib/date";

const MILESTONE_SOON_DAYS = 5;

const DOT_CLASS: Record<string, string> = {
  done: "bg-border opacity-55",
  normal: "bg-highlight",
  soon: "bg-amber",
  overdue: "bg-danger",
};

const BORDER_CLASS: Record<string, string> = {
  done: "border-border",
  normal: "border-highlight",
  soon: "border-amber",
  overdue: "border-danger",
};

const RING_CLASS: Record<string, string> = {
  soon: "border-amber animate-[msPing_2.2s_ease-out_infinite]",
  overdue: "border-danger animate-[msPing_1.1s_ease-out_infinite]",
};

const CARD_H = 88; // px — fixed so the connector stub always lands cleanly, regardless of label length
const STUB_H = 20; // px
const DOT_ROW_H = 16; // px

function MilestoneCard({
  label,
  due,
  status,
  onClick,
}: {
  label: string;
  due: string;
  status: string;
  onClick: () => void;
}) {
  const overdue = status === "overdue";
  return (
    <button
      onClick={onClick}
      title={`點選跳到「${label}」`}
      className={
        "rounded-lg px-2 py-1.5 text-center bg-card w-full flex flex-col items-center justify-center cursor-pointer hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
        (overdue ? "border-4 animate-[milestoneOverdueFlash_1s_ease-in-out_infinite] " : "border-2 ") +
        BORDER_CLASS[status]
      }
      style={{ height: CARD_H }}
    >
      <div className="text-[14.5px] font-bold text-ink leading-tight line-clamp-2">{label}</div>
      <div className="text-[13px] font-mono text-ink-soft mt-0.5 shrink-0">{due}</div>
    </button>
  );
}

export function ProgressPanel({ c, onJump }: { c: Case; onJump: (taskId: string) => void }) {
  const { doneCount, total, pct } = caseProgress(c);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const markers = c.tasks
    .filter((t) => t.milestone)
    .map((t) => {
      const due = new Date(t.due + "T00:00:00");
      const daysLeft = daysBetween(today, due);
      const status = t.done ? "done" : daysLeft < 0 ? "overdue" : daysLeft <= MILESTONE_SOON_DAYS ? "soon" : "normal";
      const label = MILESTONE_ORDER.find((m) => m.key === t.milestone)?.label || t.label;
      return { id: t.id, label, due: t.due, status };
    })
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  return (
    <div className="mb-4.5">
      <div className="flex items-end justify-between gap-3 mb-2 flex-wrap">
        <div>
          <div className="font-serif font-bold text-[22px] flex items-center gap-1.5 flex-wrap mb-1">
            <span className="flex items-center gap-1.5 shrink-0">
              <ChartBar weight="bold" size={18} className="text-navy" />
              整體進度
            </span>
            <span className="hidden sm:inline font-sans font-normal text-[15.5px] text-ink-soft">
              （★ 為大事記項目，點選任務清單中的星號即可設定；開啟案件時進度條會自動跑一次動畫）
            </span>
          </div>
          <div className="font-mono text-[17px] font-bold text-ink-soft">
            {doneCount} / {total} 項已完成
          </div>
        </div>
      </div>

      <div className="relative h-6 mb-8">
        <div className="h-6 w-full rounded-lg overflow-hidden border border-border bg-muted">
          <div
            className="h-full rounded-lg bg-[linear-gradient(90deg,var(--color-sky),var(--color-navy))] animate-[barFill_1.4s_ease-out_forwards]"
            style={{ ["--target-width" as string]: `${pct}%` }}
          />
        </div>
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-[left] duration-500 ease-out"
          style={{ left: `${Math.min(94, Math.max(6, pct))}%` }}
        >
          <span className="bg-card border border-border rounded-full px-2.5 py-0.5 text-[15.5px] font-mono font-black text-ink shadow-[0_1px_3px_rgba(0,0,0,0.15)] whitespace-nowrap">
            {pct}%
          </span>
        </div>
      </div>

      {markers.length > 0 ? (
        // py-3 gives the overdue flash glow room to breathe — overflow-x-auto implicitly clips
        // overflow-y too, so a box-shadow glow flush against the top/bottom edge gets cut off
        // without this padding.
        <div className="overflow-x-auto py-3 -my-3">
          <div className="flex" style={{ minWidth: markers.length * 140 }}>
            {markers.map((m, i) => {
              const isAbove = i % 2 === 0;
              return (
                <div key={m.id} className="flex-1 min-w-[130px] px-1.5 flex flex-col items-center" title={`${m.label}：${m.due}`}>
                  <div style={{ height: CARD_H }} className="w-full flex items-end">
                    {isAbove && <MilestoneCard label={m.label} due={m.due} status={m.status} onClick={() => onJump(m.id)} />}
                  </div>
                  <div style={{ height: STUB_H }} className={"w-px bg-border " + (isAbove ? "" : "invisible")} />
                  <div style={{ height: DOT_ROW_H }} className="relative w-full flex items-center justify-center">
                    {i > 0 && <div className="absolute right-1/2 w-full h-0.5 bg-border/60" />}
                    <span className="relative w-3 h-3 shrink-0">
                      <span className={"absolute -inset-1 rounded-full border-2 border-transparent " + (RING_CLASS[m.status] ?? "")} />
                      <span className={"absolute inset-0 rounded-full shadow-[0_0_0_2px_var(--color-card)] z-10 " + DOT_CLASS[m.status]} />
                    </span>
                  </div>
                  <div style={{ height: STUB_H }} className={"w-px bg-border " + (isAbove ? "invisible" : "")} />
                  <div style={{ height: CARD_H }} className="w-full flex items-start">
                    {!isAbove && <MilestoneCard label={m.label} due={m.due} status={m.status} onClick={() => onJump(m.id)} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-[15.5px] text-ink-soft text-center py-3">尚未設定任何大事記項目，可在任務清單點選星號設定。</div>
      )}
    </div>
  );
}
