"use client";

import { useState } from "react";
import { Star, Warning } from "@phosphor-icons/react";
import { Case } from "@/lib/types";
import { urgentTasks } from "@/lib/derived";

const MAX_VISIBLE = 12;

export function AlertBanner({ c, onJump }: { c: Case; onJump: (taskId: string) => void }) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const urgent = urgentTasks(c);
  if (urgent.length === 0) return null;

  const overdueCount = urgent.filter((t) => new Date(t.due + "T00:00:00") < today).length;
  const visible = urgent.slice(0, MAX_VISIBLE);
  const hiddenCount = urgent.length - visible.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`警示提醒・${urgent.length} 項`}
        className={
          "fixed top-20 right-4.5 z-40 w-12 h-12 rounded-full flex items-center justify-center border-2 shadow-[0_4px_14px_rgba(0,0,0,0.3)] cursor-pointer hover:brightness-95 transition-[filter] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
          (overdueCount > 0
            ? "bg-danger-soft border-danger animate-[alertGlow_1.8s_ease-in-out_infinite]"
            : "bg-highlight-soft border-highlight")
        }
      >
        <Warning weight="fill" size={22} className="text-danger" />
        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-danger text-white text-[14.5px] font-bold font-mono flex items-center justify-center border-2 border-card">
          {urgent.length}
        </span>
      </button>

      {open && (
        <>
          {/* Invisible click-catcher for outside-click-to-close — no dark backdrop, since the
              panel is meant to read as a docked side-panel beside the bell button, not a modal. */}
          <div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />
          <div className="fixed top-20 right-[76px] z-[999] bg-card border border-border rounded-[10px] py-4 px-4.5 w-[380px] max-w-[calc(100vw-100px)] max-h-[75vh] flex flex-col shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
            <div className="text-[15.5px] font-mono font-bold text-ink-soft tracking-[0.15em] uppercase px-0.5 pb-3 flex items-center gap-1.5 shrink-0">
              <Warning weight="fill" size={14} className="text-danger" />
              警示提醒・{urgent.length}
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto">
              {visible.map((t) => {
                const due = new Date(t.due + "T00:00:00");
                const overdue = due < today;
                const isToday = due.getTime() === today.getTime();
                const tag = overdue ? "已逾期" : isToday ? "今天" : "即將到期";
                const overdueMilestone = overdue && !!t.milestone;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setOpen(false);
                      onJump(t.id);
                    }}
                    className={
                      "text-left rounded-lg py-2.5 px-3 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.12)] hover:brightness-95 transition-[filter] " +
                      (overdueMilestone
                        ? "border-4 bg-danger-soft border-danger animate-[milestoneOverdueFlash_1s_ease-in-out_infinite] "
                        : overdue
                        ? "border-2 bg-danger-soft border-danger "
                        : "border-2 bg-highlight-soft border-highlight ")
                    }
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Warning weight="fill" size={13} className="shrink-0 text-danger" />
                      <span className="text-[14.5px] font-bold text-danger">{tag}</span>
                      {t.milestone && <Star weight="fill" size={11} className="text-highlight shrink-0" />}
                    </div>
                    <div className="text-[17.5px] font-bold text-ink leading-snug">{t.label}</div>
                    <div className="text-[14.5px] font-mono text-ink-soft mt-0.5">{t.due}</div>
                  </button>
                );
              })}
              {hiddenCount > 0 && (
                <div className="text-center text-[14.5px] text-ink-soft py-1">…等共 {hiddenCount} 項</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
