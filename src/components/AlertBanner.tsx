"use client";

import { Case } from "@/lib/types";

export function AlertBanner({ c, onJump }: { c: Case; onJump: (taskId: string) => void }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 2);

  const urgent = c.tasks
    .filter((t) => {
      if (t.done) return false;
      const due = new Date(t.due + "T00:00:00");
      return due <= soon;
    })
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());

  if (urgent.length === 0) return null;

  const overdueCount = urgent.filter((t) => new Date(t.due + "T00:00:00") < today).length;

  return (
    <div className={"alert-banner" + (overdueCount > 0 ? " danger" : "")}>
      <div className="alert-icon">⚠️</div>
      <div className="alert-body">
        <div className="alert-title">有 {urgent.length} 項任務即將到期或已逾期！點一下可跳到清單中的項目</div>
        <div className="alert-chips">
          {urgent.slice(0, 6).map((t) => {
            const due = new Date(t.due + "T00:00:00");
            const tag = due < today ? "已逾期" : due.getTime() === today.getTime() ? "今天" : "即將到期";
            return (
              <button key={t.id} className="alert-chip" onClick={() => onJump(t.id)}>
                {t.milestone ? "🚩 " : ""}
                {t.label}（{tag}）
              </button>
            );
          })}
          {urgent.length > 6 && (
            <span className="alert-chip" style={{ cursor: "default" }}>
              …等共 {urgent.length} 項
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
