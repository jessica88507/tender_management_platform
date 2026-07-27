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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[16px] font-bold text-accent tracking-[0.2em] mb-2.5 uppercase border-l-[3px] border-primary pl-2.5">
      {children}
    </div>
  );
}

export function CaseView({ caseId, caseData }: { caseId: string; caseData: Case }) {
  const { ui, setViewMode, updateCase, canEditActive } = useApp();

  useEffect(() => {
    // Read-only viewers must never trigger a save — this normalization pass is a
    // backfill-defaults convenience for the editor, not something a viewer should persist.
    if (!canEditActive) return;
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
  }, [caseId, canEditActive]);

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
      {/* Floating bell button (top-right) + click-to-open modal — see AlertBanner.tsx. */}
      <AlertBanner c={c} onJump={jumpToTask} />

      {/* 1. Page title — case name + days-remaining stamp, always visible, no card chrome. */}
      <CaseHeader caseId={caseId} c={c} />

      {/* 2. 案件總覽：overall progress. */}
      <section className="mb-8 animate-[fadeInUp_0.4s_ease-out]">
        <SectionLabel>案件總覽 · Overview</SectionLabel>
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <ProgressPanel key={caseId} c={c} onJump={jumpToTask} />
        </div>
      </section>

      {/* 3. 案件設定：collapsible detail/edit panels, grouped as one settings zone. */}
      <section className="mb-8 animate-[fadeInUp_0.4s_ease-out]" style={{ animationDelay: "0.05s", animationFillMode: "backwards" }}>
        <SectionLabel>案件設定 · Case Settings</SectionLabel>
        <InfoPanel caseId={caseId} c={c} totalDays={totalDays} />
        <TeamPanel caseId={caseId} c={c} />
      </section>

      {/* 4. 時程管理：the main workspace — list/calendar toggle + the view itself. Boxed in a
             card like the other two sections so all three zones read as consistent blocks. */}
      <section className="animate-[fadeInUp_0.4s_ease-out]" style={{ animationDelay: "0.1s", animationFillMode: "backwards" }}>
        <SectionLabel>時程管理 · Schedule</SectionLabel>
        <div className="bg-card border border-border rounded-lg p-5 shadow-sm">
          <div className="flex mb-5.5 border border-ink rounded-md overflow-hidden w-fit">
            <button
              onClick={() => setViewMode("cal")}
              className={
                "py-2.5 px-5 text-[19px] font-bold cursor-pointer border-r border-ink flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (ui.viewMode === "cal" ? "bg-ink text-card" : "bg-card text-ink-soft hover:bg-muted")
              }
            >
              <CalendarBlank weight="bold" size={16} />
              行事曆檢視
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={
                "py-2.5 px-5 text-[19px] font-bold cursor-pointer flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (ui.viewMode === "list" ? "bg-ink text-card" : "bg-card text-ink-soft hover:bg-muted")
              }
            >
              <ListChecks weight="bold" size={16} />
              任務清單
            </button>
          </div>

          {ui.viewMode === "list" ? <ListView caseId={caseId} c={c} /> : <CalendarView caseId={caseId} c={c} />}
        </div>
      </section>
    </div>
  );
}
