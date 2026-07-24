"use client";

import { useApp } from "@/context/AppContext";
import { caseDaysLeft } from "@/lib/derived";

export function Sidebar({ onShowNew }: { onShowNew: () => void }) {
  const { state, activeId, setActiveId } = useApp();

  const ids = Object.keys(state.cases).sort(
    (a, b) => new Date(state.cases[a].deadline).getTime() - new Date(state.cases[b].deadline).getTime()
  );

  return (
    <div className="sidebar">
      <div className="brand">
        備標控台
        <span>BID PREP CONTROL</span>
      </div>
      <div>
        {ids.map((id) => {
          const c = state.cases[id];
          const days = caseDaysLeft(c);
          return (
            <button
              key={id}
              className={"case-tab" + (id === activeId ? " active" : "")}
              onClick={() => setActiveId(id)}
            >
              <span className="cname">{c.name}</span>
              <span className="cdays">{days >= 0 ? `尚餘 ${days} 天` : `已逾期 ${-days} 天`}</span>
            </button>
          );
        })}
      </div>
      <button className="add-case-btn" onClick={onShowNew}>
        ＋ 新增案件
      </button>
    </div>
  );
}
