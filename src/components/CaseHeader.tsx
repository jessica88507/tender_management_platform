"use client";

import { Case } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { caseDaysLeft } from "@/lib/derived";

export function CaseHeader({ caseId, c }: { caseId: string; c: Case }) {
  const { updateCase } = useApp();
  const daysLeft = caseDaysLeft(c);

  return (
    <div className="case-header">
      <div className="case-title-wrap" style={{ flex: 1 }}>
        <input
          className="title-input"
          value={c.name}
          onChange={(e) => {
            const val = e.target.value;
            updateCase(caseId, (draft) => {
              draft.name = val;
            });
          }}
        />
      </div>
      <div className={"stamp" + (daysLeft < 0 ? " overdue" : "")}>
        <div className="s-top">尚餘</div>
        <div className="s-num">{daysLeft >= 0 ? daysLeft : "逾"}</div>
        <div className="s-bottom">{daysLeft >= 0 ? "天" : "期"}</div>
      </div>
    </div>
  );
}
