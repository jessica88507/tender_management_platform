"use client";

import { Plus } from "@phosphor-icons/react";
import { useApp } from "@/context/AppContext";
import { caseDaysLeft } from "@/lib/derived";

export function Sidebar({ onShowNew }: { onShowNew: () => void }) {
  const { state, activeId, setActiveId } = useApp();

  const ids = Object.keys(state.cases).sort(
    (a, b) => new Date(state.cases[a].deadline).getTime() - new Date(state.cases[b].deadline).getTime()
  );

  return (
    <div className="w-[230px] shrink-0 py-7 pr-0 pl-4.5 border-r border-line-grey overflow-y-auto">
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
                "block w-full text-left rounded-l-lg py-3 pr-3.5 pl-4 mb-2 cursor-pointer text-[14.5px] transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chop-red " +
                (isActive
                  ? "bg-paper-light text-ink font-bold -translate-x-1 shadow-[-2px_2px_0_rgba(0,0,0,0.06)] border border-r-0 border-tab-brown"
                  : "bg-paper text-ink-soft border border-r-0 border-line-grey hover:bg-[#E3D9C2]")
              }
            >
              <span className="block mb-0.5 truncate">{c.name}</span>
              <span className="font-mono text-xs font-bold text-chop-red">
                {days >= 0 ? `尚餘 ${days} 天` : `已逾期 ${-days} 天`}
              </span>
            </button>
          );
        })}
      </div>
      <button
        onClick={onShowNew}
        className="w-full mt-2.5 py-3 px-3.5 rounded-l-lg border-[1.5px] border-dashed border-tab-brown text-tab-brown text-[14.5px] font-bold cursor-pointer hover:bg-tab-brown/10 flex items-center justify-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chop-red"
      >
        <Plus weight="bold" size={16} />
        新增案件
      </button>
    </div>
  );
}
