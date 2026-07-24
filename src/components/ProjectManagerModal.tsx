"use client";

import { useApp } from "@/context/AppContext";
import { useConfirm } from "@/context/ConfirmContext";
import { caseDaysLeft, caseProgress } from "@/lib/derived";

export function ProjectManagerModal({ onClose }: { onClose: () => void }) {
  const { state, setActiveId, deleteCase } = useApp();
  const { customConfirm } = useConfirm();

  const ids = Object.keys(state.cases).sort(
    (a, b) => new Date(state.cases[a].deadline).getTime() - new Date(state.cases[b].deadline).getTime()
  );

  const handleDelete = async (id: string) => {
    const c = state.cases[id];
    const ok = await customConfirm(`確定要刪除「${c.name}」這個案件嗎？此動作無法復原。`);
    if (!ok) return;
    deleteCase(id);
  };

  return (
    <div
      className="fixed inset-0 bg-ink/45 flex items-center justify-center z-[999]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-paper-light border border-line-grey rounded-[10px] py-5 px-5.5 shadow-[0_8px_24px_rgba(0,0,0,0.25)] max-w-[760px] w-[90vw]">
        <h2 className="font-serif text-xl mb-4">專案管理</h2>
        {ids.length === 0 ? (
          <div className="font-serif text-lg text-ink-soft mt-5">目前沒有任何案件。</div>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="text-left font-mono text-[11px] text-ink-soft border-b-2 border-ink py-1.5 px-2">案件名稱</th>
                <th className="text-left font-mono text-[11px] text-ink-soft border-b-2 border-ink py-1.5 px-2">開始作業期程</th>
                <th className="text-left font-mono text-[11px] text-ink-soft border-b-2 border-ink py-1.5 px-2">投標截止</th>
                <th className="text-left font-mono text-[11px] text-ink-soft border-b-2 border-ink py-1.5 px-2">剩餘天數</th>
                <th className="text-left font-mono text-[11px] text-ink-soft border-b-2 border-ink py-1.5 px-2">進度</th>
                <th className="border-b-2 border-ink py-1.5 px-2"></th>
                <th className="border-b-2 border-ink py-1.5 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const c = state.cases[id];
                const days = caseDaysLeft(c);
                const { pct } = caseProgress(c);
                return (
                  <tr key={id}>
                    <td className="border-b border-dashed border-line-grey py-2 px-2">{c.name}</td>
                    <td className="border-b border-dashed border-line-grey py-2 px-2 font-mono">{c.workStart || c.start}</td>
                    <td className="border-b border-dashed border-line-grey py-2 px-2 font-mono">{c.deadline.replace("T", " ")}</td>
                    <td className={"border-b border-dashed border-line-grey py-2 px-2 font-mono " + (days < 0 ? "text-danger" : "text-ink-soft")}>
                      {days >= 0 ? `${days} 天` : "已逾期"}
                    </td>
                    <td className="border-b border-dashed border-line-grey py-2 px-2 font-mono">{pct}%</td>
                    <td className="border-b border-dashed border-line-grey py-2 px-2">
                      <button
                        onClick={() => {
                          setActiveId(id);
                          onClose();
                        }}
                        className="bg-transparent border border-tab-brown text-tab-brown rounded-md py-1 px-2.5 text-[11.5px] cursor-pointer hover:bg-tab-brown/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chop-red"
                      >
                        開啟
                      </button>
                    </td>
                    <td className="border-b border-dashed border-line-grey py-2 px-2">
                      <button
                        onClick={() => handleDelete(id)}
                        className="bg-transparent border border-danger text-danger rounded-md py-1 px-2.5 text-[11.5px] cursor-pointer hover:bg-danger hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                      >
                        刪除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="bg-transparent border-[1.5px] border-tab-brown text-tab-brown py-2 px-3.5 rounded-md text-[13px] font-bold cursor-pointer hover:bg-tab-brown/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chop-red"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
