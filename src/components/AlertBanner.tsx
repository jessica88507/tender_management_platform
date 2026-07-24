"use client";

import { Star, Warning } from "@phosphor-icons/react";
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
  const danger = overdueCount > 0;

  return (
    <div
      className={
        "flex items-start gap-3 rounded-[10px] border-2 py-3 px-4 mb-4 animate-[alertGlow_1.8s_ease-in-out_infinite] " +
        (danger ? "bg-[#FBE2DE] border-danger" : "bg-[#FCEFD9] border-accent-gold")
      }
    >
      <Warning weight="fill" size={26} className="shrink-0 text-danger" />
      <div>
        <div className="font-bold text-[15px] text-ink mb-1.5">
          有 {urgent.length} 項任務即將到期或已逾期！點一下可跳到清單中的項目
        </div>
        <div className="flex flex-wrap gap-2">
          {urgent.slice(0, 6).map((t) => {
            const due = new Date(t.due + "T00:00:00");
            const tag = due < today ? "已逾期" : due.getTime() === today.getTime() ? "今天" : "即將到期";
            return (
              <button
                key={t.id}
                onClick={() => onJump(t.id)}
                className="inline-flex items-center gap-1 bg-white border border-line-grey rounded-xl py-1 px-3 text-[12.5px] text-ink-soft cursor-pointer hover:bg-chop-red hover:text-white hover:border-chop-red"
              >
                {t.milestone && <Star weight="fill" size={12} className="text-accent-gold" />}
                {t.label}（{tag}）
              </button>
            );
          })}
          {urgent.length > 6 && (
            <span className="inline-flex items-center bg-white border border-line-grey rounded-xl py-1 px-3 text-[12.5px] text-ink-soft cursor-default">
              …等共 {urgent.length} 項
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
