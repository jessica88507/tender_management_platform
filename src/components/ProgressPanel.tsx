"use client";

import { Case } from "@/lib/types";
import { MILESTONE_ORDER } from "@/lib/constants";
import { caseProgress } from "@/lib/derived";

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
      const overdue = !t.done && due < today;
      const label = MILESTONE_ORDER.find((m) => m.key === t.milestone)?.label || t.label;
      const cls = t.done ? "done" : overdue ? "overdue" : "pending";
      const title = `${label}：${t.due}${t.done ? "（已完成）" : overdue ? "（已逾期！）" : ""}`;
      return { id: t.id, posPct, cls, title };
    });

  return (
    <div className="progress-wrap">
      <div className="sec-title">
        📊 整體進度
        <span style={{ fontWeight: 400, fontSize: 12, color: "var(--ink-soft)" }}>
          {" "}
          （🚩為大事記項目，隨清單勾選同步更新）
        </span>
      </div>
      <div className="progress-label">
        <span>
          {doneCount} / {c.tasks.length} 項已完成
        </span>
        <span>{pct}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="ms-marker-layer">
          {markers.map((m) => (
            <div
              key={m.id}
              className={`ms-marker ${m.cls}`}
              style={{ left: `${m.posPct}%` }}
              title={m.title}
            >
              🚩
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
