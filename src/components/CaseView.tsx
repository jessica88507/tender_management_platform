"use client";

import { useEffect, useState } from "react";
import { CalendarBlank, Columns, ListChecks } from "@phosphor-icons/react";
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
import { SimpleTaskList } from "./SimpleTaskList";
import { isOnboardingDismissed, OnboardingTutorial } from "./OnboardingTutorial";

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
  const { ui, setViewMode, updateCase, isCaseOwner, justCreatedId } = useApp();
  const [showTutorial, setShowTutorial] = useState(false);

  // "Adjust state during render" pattern (see react.dev) instead of an effect: reacts once per
  // unique justCreatedId change rather than needing an explicit clear-flag round trip through
  // context, and avoids the set-state-in-effect lint rule for a synchronous setState call.
  const [seenJustCreatedId, setSeenJustCreatedId] = useState<string | null>(null);
  if (justCreatedId !== seenJustCreatedId) {
    setSeenJustCreatedId(justCreatedId);
    if (justCreatedId === caseId && !isOnboardingDismissed()) setShowTutorial(true);
  }

  useEffect(() => {
    // Only the actual owner's own view triggers this backfill-defaults normalization — anyone
    // else viewing the case would otherwise silently fire the non-owner edit-confirmation the
    // moment they open it, which isn't a real edit and shouldn't be gated as one.
    if (!isCaseOwner) return;
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
  }, [caseId, isCaseOwner]);

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
      <CaseHeader caseId={caseId} c={c} onOpenTutorial={() => setShowTutorial(true)} />

      {showTutorial && <OnboardingTutorial onClose={() => setShowTutorial(false)} />}

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
          {/* whitespace-nowrap: CJK text has no spaces, so without it these labels can shrink to
              a single character wide and wrap into a vertical stack under width pressure. Label
              text hides below sm (icon-only, title tooltip carries the label) since even at the
              15%-smaller size, all three full labels don't fit a phone-width row. */}
          <div className="flex mb-5.5 border border-ink rounded-md overflow-hidden w-fit" data-tutorial="schedule-toggle">
            <button
              onClick={() => setViewMode("cal")}
              title="行事曆檢視"
              className={
                "py-2 px-3 sm:px-4 text-[16px] font-bold cursor-pointer border-r border-ink flex items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (ui.viewMode === "cal" ? "bg-ink text-card" : "bg-card text-ink-soft hover:bg-muted")
              }
            >
              <CalendarBlank weight="bold" size={14} />
              <span className="hidden sm:inline">行事曆檢視</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              title="任務清單"
              className={
                "py-2 px-3 sm:px-4 text-[16px] font-bold cursor-pointer border-r border-ink flex items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (ui.viewMode === "list" ? "bg-ink text-card" : "bg-card text-ink-soft hover:bg-muted")
              }
            >
              <ListChecks weight="bold" size={14} />
              <span className="hidden sm:inline">任務清單</span>
            </button>
            <button
              onClick={() => setViewMode("both")}
              title="兩者檢視"
              className={
                "py-2 px-3 sm:px-4 text-[16px] font-bold cursor-pointer flex items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
                (ui.viewMode === "both" ? "bg-ink text-card" : "bg-card text-ink-soft hover:bg-muted")
              }
            >
              <Columns weight="bold" size={14} />
              <span className="hidden sm:inline">兩者檢視</span>
            </button>
          </div>

          {ui.viewMode === "list" ? (
            <ListView caseId={caseId} c={c} />
          ) : ui.viewMode === "both" ? (
            // Side-by-side only at lg+ — below that, a 1/5-width column leaves no room for
            // readable CJK task labels (they'd otherwise compress to one character per line).
            <div className="flex flex-col lg:flex-row gap-4 items-start">
              <div className="w-full lg:w-4/5 min-w-0">
                <CalendarView caseId={caseId} c={c} />
              </div>
              <div className="w-full lg:w-1/5 min-w-0 lg:shrink-0 max-h-[400px] lg:max-h-[900px] overflow-y-auto border-t lg:border-t-0 lg:border-l border-border pt-3 lg:pt-0 lg:pl-3.5">
                <SimpleTaskList caseId={caseId} c={c} />
              </div>
            </div>
          ) : (
            <CalendarView caseId={caseId} c={c} />
          )}
        </div>
      </section>
    </div>
  );
}
