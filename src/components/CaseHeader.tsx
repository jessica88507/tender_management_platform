"use client";

import { FileArrowDown, Warning, Lightbulb } from "@phosphor-icons/react";
import { Case } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { caseDaysLeft } from "@/lib/derived";

export function CaseHeader({
  caseId,
  c,
  onOpenTutorial,
}: {
  caseId: string;
  c: Case;
  onOpenTutorial?: () => void;
}) {
  const { updateCase, isCaseOwner } = useApp();
  const daysLeft = caseDaysLeft(c);

  return (
    <div className="border-b-2 border-ink pb-3.5 mb-4" data-tutorial="case-header">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div className="flex-1 min-w-[220px]">
          {!isCaseOwner && (
            <div className="flex items-center gap-1.5 text-[15px] font-bold text-danger mb-1.5 bg-danger-soft border border-danger rounded py-1 px-2 w-fit">
              <Warning weight="fill" size={14} />
              你並非本案主投標手（{c.bidLead || "尚未指定"}）・修改前系統會再次確認
            </div>
          )}
          <input
            className="font-serif font-black text-[34px] sm:text-[41.5px] text-ink border-none bg-transparent w-full py-0.5 focus:outline-none focus:[outline:1px_dashed_var(--color-highlight)] disabled:cursor-not-allowed"
            value={c.name}
            onChange={(e) => {
              const val = e.target.value;
              updateCase(caseId, (draft) => {
                draft.name = val;
              });
            }}
          />
          {/* Sits flush on the header's bottom border, left-aligned — future header
              actions get added here too, in left-to-right order. */}
          <div className="flex items-center gap-2 mt-2.5">
            <a
              href={`/api/cases/${caseId}/report`}
              title="下載專案報告（PPT）"
              className="flex items-center gap-1.5 border-[1.5px] border-accent text-accent py-1.5 px-3 rounded-md text-[17px] font-bold cursor-pointer hover:bg-accent/10 active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary whitespace-nowrap"
            >
              <FileArrowDown weight="bold" size={15} />
              <span className="hidden sm:inline">下載專案簡報（PPT）</span>
              <span className="sm:hidden">下載 PPT</span>
            </a>
            {onOpenTutorial && (
              <button
                onClick={onOpenTutorial}
                title="開啟新手教學"
                className="flex items-center gap-1.5 border-[1.5px] border-border text-ink-soft py-1.5 px-3 rounded-md text-[17px] font-bold cursor-pointer hover:bg-muted active:scale-[0.97] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary whitespace-nowrap"
              >
                <Lightbulb weight="fill" size={15} />
                <span className="hidden sm:inline">新手教學</span>
              </button>
            )}
          </div>
        </div>
        <div className="w-[125px] h-[125px] sm:w-[172px] sm:h-[172px] shrink-0 rounded-full border-4 border-double bg-danger/5 border-danger text-danger flex flex-col items-center justify-center -rotate-6 font-serif">
          <div className="text-[14.5px] sm:text-[18px] tracking-[0.2em] font-bold">{daysLeft >= 0 ? "尚餘" : ""}</div>
          <div className="font-mono font-bold leading-none my-0.5 text-[44px] sm:text-[62.5px]">
            {daysLeft >= 0 ? daysLeft : "逾"}
          </div>
          <div className="text-[14.5px] sm:text-[18px] tracking-[0.2em] font-bold">{daysLeft >= 0 ? "天" : "期"}</div>
        </div>
      </div>
    </div>
  );
}
