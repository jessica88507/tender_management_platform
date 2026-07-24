"use client";

import { ChartBar } from "@phosphor-icons/react";
import { Case } from "@/lib/types";
import { MILESTONE_ORDER } from "@/lib/constants";
import { caseProgress } from "@/lib/derived";
import { daysBetween } from "@/lib/date";

const MILESTONE_SOON_DAYS = 5;

const DOT_CLASS: Record<string, string> = {
  done: "bg-line-grey opacity-55",
  normal: "bg-accent-gold",
  soon: "bg-amber",
  overdue: "bg-danger",
};

const RING_CLASS: Record<string, string> = {
  soon: "border-amber animate-[msPing_2.2s_ease-out_infinite]",
  overdue: "border-danger animate-[msPing_1.1s_ease-out_infinite]",
};

export function ProgressPanel({
  c,
  rangeStart,
  rangeEnd,
}: {
  c: Case;
  rangeStart: Date;
  rangeEnd: Date;
}) {
  const { doneCount, pct } = caseProgress(c);
  const totalMs = Math.max(rangeEnd.getTime() - rangeStart.getTime(), 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const markers = c.tasks
    .filter((t) => t.milestone)
    .map((t) => {
      const due = new Date(t.due + "T00:00:00");
      let posPct = ((due.getTime() - rangeStart.getTime()) / totalMs) * 100;
      posPct = Math.max(0, Math.min(100, posPct));
      const daysLeft = daysBetween(today, due);
      const status = t.done ? "done" : daysLeft < 0 ? "overdue" : daysLeft <= MILESTONE_SOON_DAYS ? "soon" : "normal";
      const label = MILESTONE_ORDER.find((m) => m.key === t.milestone)?.label || t.label;
      const statusText =
        status === "done"
          ? "（已完成）"
          : status === "overdue"
          ? `（已逾期 ${-daysLeft} 天！）`
          : status === "soon"
          ? `（剩 ${daysLeft} 天，快到期）`
          : "";
      const title = `${label}：${t.due}${statusText}`;
      return { id: t.id, posPct, status, title };
    });

  return (
    <div className="mb-4.5">
      <div className="font-serif font-bold text-[17px] mb-2 flex items-center gap-1.5">
        <ChartBar weight="bold" size={18} className="text-chop-red" />
        整體進度
        <span className="font-sans font-normal text-xs text-ink-soft">
          （圓點為大事記項目，顏色越紅代表越接近或已逾期，隨清單勾選同步更新）
        </span>
      </div>
      <div className="flex justify-between font-mono text-[13px] font-bold text-ink-soft mb-2">
        <span>
          {doneCount} / {c.tasks.length} 項已完成
        </span>
        <span>{pct}%</span>
      </div>
      <div className="relative pt-5">
        <div className="h-4 rounded-lg overflow-hidden border border-line-grey bg-[linear-gradient(90deg,var(--color-done-green),var(--color-amber)_55%,var(--color-chop-red)_100%)]">
          <div className="h-full rounded-lg bg-ink opacity-60 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="absolute inset-x-0 top-0 h-[22px]">
          {markers.map((m) => (
            <div
              key={m.id}
              className="absolute top-1 w-3.5 h-3.5 -translate-x-1/2"
              style={{ left: `${m.posPct}%` }}
              title={m.title}
            >
              <span className={"absolute -inset-1.5 rounded-full border-2 border-transparent " + (RING_CLASS[m.status] ?? "")} />
              <span className={"absolute inset-0 rounded-full shadow-[0_0_0_2px_var(--color-paper-light)] z-10 " + DOT_CLASS[m.status]} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
