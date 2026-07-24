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
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-box" style={{ maxWidth: 760, width: "90vw" }}>
        <h2 style={{ fontFamily: "'Noto Serif TC',serif", fontSize: 20, marginBottom: 16 }}>專案管理</h2>
        {ids.length === 0 ? (
          <div className="empty-state" style={{ marginTop: 20 }}>
            目前沒有任何案件。
          </div>
        ) : (
          <table className="pm-table">
            <thead>
              <tr>
                <th>案件名稱</th>
                <th>開始作業期程</th>
                <th>投標截止</th>
                <th>剩餘天數</th>
                <th>進度</th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const c = state.cases[id];
                const days = caseDaysLeft(c);
                const { pct } = caseProgress(c);
                return (
                  <tr key={id}>
                    <td>{c.name}</td>
                    <td style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{c.workStart || c.start}</td>
                    <td style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{c.deadline.replace("T", " ")}</td>
                    <td style={{ fontFamily: "'IBM Plex Mono',monospace", color: days < 0 ? "var(--danger)" : "var(--ink-soft)" }}>
                      {days >= 0 ? `${days} 天` : "已逾期"}
                    </td>
                    <td style={{ fontFamily: "'IBM Plex Mono',monospace" }}>{pct}%</td>
                    <td>
                      <button
                        className="pm-open"
                        onClick={() => {
                          setActiveId(id);
                          onClose();
                        }}
                      >
                        開啟
                      </button>
                    </td>
                    <td>
                      <button className="pm-del" onClick={() => handleDelete(id)}>
                        刪除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn-mini" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
}
