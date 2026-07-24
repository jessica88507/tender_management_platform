"use client";

import { useEffect } from "react";
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
          el.classList.add("flash-highlight");
          setTimeout(() => el.classList.remove("flash-highlight"), 2200);
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

      <div className="view-toggle">
        <button className={ui.viewMode === "cal" ? "active" : ""} onClick={() => setViewMode("cal")}>
          📅 行事曆檢視
        </button>
        <button className={ui.viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>
          📋 清單檢視
        </button>
      </div>

      {ui.viewMode === "list" ? <ListView caseId={caseId} c={c} /> : <CalendarView caseId={caseId} c={c} />}
    </div>
  );
}
