"use client";

import { useEffect, useState } from "react";
import { Case } from "@/lib/types";
import { caseDaysLeft, caseProgress } from "@/lib/derived";
import { useConfirm } from "@/context/ConfirmContext";

export function AdminProjectsPanel() {
  const [cases, setCases] = useState<Record<string, Case> | null>(null);
  const { customConfirm, customAlert } = useConfirm();

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((data) => setCases(data.cases ?? {}));
  }, []);

  const handleDelete = async (id: string) => {
    if (!cases) return;
    const c = cases[id];
    const ok = await customConfirm(`確定要刪除「${c.name}」這個案件嗎？此動作無法復原。`);
    if (!ok) return;
    try {
      const res = await fetch(`/api/cases/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `DELETE failed: ${res.status}`);
      }
      setCases((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      console.error(err);
      await customAlert(err instanceof Error ? err.message : "刪除失敗，請稍後再試。");
    }
  };

  const ids = cases
    ? Object.keys(cases).sort((a, b) => new Date(cases[a].deadline).getTime() - new Date(cases[b].deadline).getTime())
    : [];

  return (
    <div>
      <h2 className="font-serif text-[31px] font-bold mb-5">專案管理</h2>

      {cases === null ? (
        <div className="text-ink-soft text-[18px]">載入中…</div>
      ) : ids.length === 0 ? (
        <div className="text-ink-soft text-[18px]">目前沒有任何案件。</div>
      ) : (
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[17px]">
          <thead>
            <tr>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">案件名稱</th>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">主投標手</th>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">開始作業期程</th>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">投標截止</th>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">剩餘天數</th>
              <th className="text-left font-mono text-[14.5px] text-ink-soft border-b-2 border-ink py-1.5 px-2">進度</th>
              <th className="border-b-2 border-ink py-1.5 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => {
              const c = cases[id];
              const days = caseDaysLeft(c);
              const { pct } = caseProgress(c);
              return (
                <tr key={id}>
                  <td className="border-b border-dashed border-border py-2 px-2">{c.name}</td>
                  <td className="border-b border-dashed border-border py-2 px-2">{c.bidLead || "—"}</td>
                  <td className="border-b border-dashed border-border py-2 px-2 font-mono">{c.workStart || c.start}</td>
                  <td className="border-b border-dashed border-border py-2 px-2 font-mono">{c.deadline.replace("T", " ")}</td>
                  <td className={"border-b border-dashed border-border py-2 px-2 font-mono " + (days < 0 ? "text-danger" : "text-ink-soft")}>
                    {days >= 0 ? `${days} 天` : "已逾期"}
                  </td>
                  <td className="border-b border-dashed border-border py-2 px-2 font-mono">{pct}%</td>
                  <td className="border-b border-dashed border-border py-2 px-2">
                    <button
                      onClick={() => handleDelete(id)}
                      className="bg-transparent border border-danger text-danger rounded-md py-1 px-2.5 text-[15px] cursor-pointer hover:bg-danger hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
