"use client";

import { useEffect, useState } from "react";
import { Case } from "@/lib/types";
import { caseDaysLeft, caseProgress } from "@/lib/derived";

export function AdminProjectsPanel() {
  const [cases, setCases] = useState<Record<string, Case> | null>(null);

  useEffect(() => {
    fetch("/api/cases")
      .then((r) => r.json())
      .then((data) => setCases(data.cases ?? {}));
  }, []);

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
