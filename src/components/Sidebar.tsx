"use client";

import { useState } from "react";
import { CaretLineLeft, CaretLineRight, LockSimple, Plus } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { caseDaysLeft, canEditCase } from "@/lib/derived";

const COLLAPSE_KEY = "bid-scheduler-sidebar-collapsed";

export function Sidebar({ onShowNew }: { onShowNew: () => void }) {
  const { state, activeId, setActiveId, currentUserId } = useApp();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = window.localStorage.getItem(COLLAPSE_KEY);
    if (stored !== null) return stored === "1";
    // No saved preference yet (first visit) — default collapsed on narrow viewports so the
    // fixed-width case list doesn't eat most of the screen on phones/small tablets.
    return window.innerWidth < 860;
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  const ids = Object.keys(state.cases).sort(
    (a, b) => new Date(state.cases[a].deadline).getTime() - new Date(state.cases[b].deadline).getTime()
  );

  if (collapsed) {
    return (
      <div className="w-12 shrink-0 py-7 border-r border-border flex flex-col items-center gap-2.5">
        <button
          onClick={toggleCollapsed}
          title="展開側欄"
          className="w-8 h-8 flex items-center justify-center rounded-md text-accent cursor-pointer hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <CaretLineRight weight="bold" size={16} />
        </button>
        <button
          onClick={onShowNew}
          title="新增案件"
          className="w-8 h-8 flex items-center justify-center rounded-md border-[1.5px] border-dashed border-accent text-accent cursor-pointer hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <Plus weight="bold" size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-[230px] shrink-0 py-7 pr-0 pl-4.5 border-r border-border overflow-y-auto">
      <button
        onClick={toggleCollapsed}
        title="收合側欄"
        className="flex items-center gap-1.5 mb-3.5 pr-3.5 text-[14.5px] text-ink-soft cursor-pointer hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
      >
        <CaretLineLeft weight="bold" size={13} />
        收合側欄
      </button>
      <div>
        {ids.map((id) => {
          const c = state.cases[id];
          const days = caseDaysLeft(c);
          const isActive = id === activeId;
          return (
            <button
              key={id}
              onClick={() => setActiveId(id)}
              className={
                "block w-full text-left rounded-l-lg py-3 pr-3.5 pl-4 mb-2 cursor-pointer text-[20px] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (isActive
                  ? "bg-card text-ink font-bold -translate-x-1 shadow-[-2px_2px_0_var(--shadow-tab)] border border-r-0 border-accent"
                  : "bg-background text-ink-soft border border-r-0 border-border hover:bg-muted")
              }
            >
              <span className="flex items-center gap-1 mb-0.5">
                <span className="truncate">{c.name}</span>
                {!canEditCase(c, currentUserId) && (
                  <span title="唯讀" className="shrink-0 inline-flex text-ink-soft">
                    <LockSimple weight="bold" size={12} />
                  </span>
                )}
              </span>
              {c.bidLead && <div className="text-[16px] text-ink-soft truncate mb-0.5">主投標手：{c.bidLead}</div>}
              <span className="font-mono text-[17px] font-bold text-danger">
                {days >= 0 ? `尚餘 ${days} 天` : `已逾期 ${-days} 天`}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onShowNew}
        className="w-full mt-2.5 py-3 px-3.5 rounded-l-lg border-[1.5px] border-dashed border-accent text-accent text-[20px] font-bold cursor-pointer hover:bg-accent/10 flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Plus weight="bold" size={16} />
        新增案件
      </button>
    </div>
  );
}
