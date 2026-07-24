"use client";

import { Case } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { caseDaysLeft } from "@/lib/derived";

export function CaseHeader({ caseId, c }: { caseId: string; c: Case }) {
  const { updateCase } = useApp();
  const daysLeft = caseDaysLeft(c);
  const overdue = daysLeft < 0;

  return (
    <div className="flex justify-between items-start border-b-2 border-ink pb-3.5 mb-4">
      <div className="flex-1">
        <input
          className="font-serif font-black text-[29px] text-ink border-none bg-transparent w-full py-0.5 focus:outline-none focus:[outline:1px_dashed_var(--color-accent-gold)]"
          value={c.name}
          onChange={(e) => {
            const val = e.target.value;
            updateCase(caseId, (draft) => {
              draft.name = val;
            });
          }}
        />
      </div>
      <div
        className={
          "w-[118px] h-[118px] shrink-0 rounded-full border-4 border-double flex flex-col items-center justify-center -rotate-6 font-serif bg-[radial-gradient(circle,rgba(174,54,43,0.05),transparent_70%)] " +
          (overdue ? "border-ink-soft text-ink-soft" : "border-chop-red text-chop-red")
        }
      >
        <div className="text-xs tracking-[0.2em] font-bold">尚餘</div>
        <div className="font-mono text-[40px] font-bold leading-none my-0.5">
          {daysLeft >= 0 ? daysLeft : "逾"}
        </div>
        <div className="text-xs tracking-[0.2em] font-bold">{daysLeft >= 0 ? "天" : "期"}</div>
      </div>
    </div>
  );
}
