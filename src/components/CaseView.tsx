"use client";

import { useEffect } from "react";
import { CalendarBlank, ListChecks } from "@phosphor-icons/react";
import { Case } from "@/lib/types";
import { useApp } from "@/context/AppContext";
import { normalizeCase, normalizeTeam } from "@/lib/scheduler";
import { daysBetween } from "@/lib/date";
import { CaseHeader } from "./CaseHeader";
import { AlertBanner } from "./AlertBanner";
import { ProgressPanel } from "./ProgressPanel";
import { InfoPanel } from "./InfoPanel";
import { TeamPanel } from "./TeamPanel";
import { ListView } from "./ListView";
import { CalendarView } from "./CalendarView";

// Referenced literally so Tailwind's build-time scanner generates the CSS for this
// arbitrary-value animation utility, even though it's applied imperatively via classList.
const FLASH_CLASS = "animate-[flashHi_2.2s_ease]";

export function CaseView({ caseId, caseData }: { caseId: string; caseData: Case }) {
  const { ui, setViewMode, updateCase } = useApp();

  useEffect(() => {
    updateCase(caseId, (draft) => {
      if (!draft.weekNotes) draft.weekNotes = {};
      draft.team = normalizeTeam(draft.team);
      normalizeCase(draft);
      draft.tasks.forEach((t) => {
        if (t.owner === undefined) t.owner = "";
        if (t.milestone === undefined) t.milestone = null;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const c = caseData;
  const deadlineDT = new Date(c.deadline);
  const deadlineDateOnly = new Date(deadlineDT.getFullYear(), deadlineDT.getMonth(), deadlineDT.getDate());
  const workStartDate = new Date((c.workStart || c.start) + "T00:00:00");
  const totalDays = Math.max(daysBetween(workStartDate, deadlineDateOnly), 1);

  const jumpToTask = (taskId: string) => {
    setViewMode("list");
    requestAnimationFrame(() => {
      setTimeout(() => {
        const el = document.getElementById(`task-row-${taskId}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add(FLASH_CLASS);
          setTimeout(() => el.classList.remove(FLASH_CLASS), 2200);
        }
      }, 50);
    });
  };

  return (
    <div>
      <CaseHeader caseId={caseId} c={c} />
      <AlertBanner c={c} onJump={jumpToTask} />
      <ProgressPanel c={c} rangeStart={workStartDate} rangeEnd={deadlineDateOnly} />
      <InfoPanel caseId={caseId} c={c} totalDays={totalDays} />
      <TeamPanel caseId={caseId} c={c} />

      <div className="flex mb-5.5 border border-ink rounded-md overflow-hidden w-fit">
        <button
          onClick={() => setViewMode("cal")}
          className={
            "py-2.5 px-5 text-sm font-bold cursor-pointer border-r border-ink flex items-center gap-1.5 " +
            (ui.viewMode === "cal" ? "bg-ink text-paper-light" : "bg-paper-light text-ink-soft")
          }
        >
          <CalendarBlank weight="bold" size={15} />
          行事曆檢視
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={
            "py-2.5 px-5 text-sm font-bold cursor-pointer flex items-center gap-1.5 " +
            (ui.viewMode === "list" ? "bg-ink text-paper-light" : "bg-paper-light text-ink-soft")
          }
        >
          <ListChecks weight="bold" size={15} />
          清單檢視
        </button>
      </div>

      {ui.viewMode === "list" ? <ListView caseId={caseId} c={c} /> : <CalendarView caseId={caseId} c={c} />}
    </div>
  );
}
