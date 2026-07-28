import { Case, Task } from "./types";
import { addDays, daysBetween, snapToBizDay, toISO } from "./date";

export function caseDaysLeft(c: Case): number {
  return daysBetween(new Date(), new Date(c.deadline));
}

// 招標公告／投標截止 (milestone "collect"/"deadline") are calendar-only markers, not checkable
// work items — see CalendarView/ListView/SimpleTaskList/EventDetailModal — so they're excluded
// from the completion count, otherwise a case could never reach 100%.
const NON_CHECKABLE_MILESTONES = new Set(["collect", "deadline"]);
export function isNonCheckableTask(t: Task): boolean {
  return !!t.milestone && NON_CHECKABLE_MILESTONES.has(t.milestone);
}

// Not-done tasks due within 2 days (including overdue). Sorted by severity tier first — overdue
// 大事記 (milestones) rank above everything else, then overdue non-milestones, then upcoming
// milestones, then upcoming non-milestones — and by due date ascending within each tier.
// Shared by AlertBanner (renders the list) and CaseView (decides whether to reserve a right
// column for it at all) so the two never drift out of sync.
// 施工評選簡報日 is a fixed owner-side date, not an action item the bid team is late on — once the
// date passes there's nothing left to "catch up" on, so it'd otherwise sit in the overdue tier
// forever. Still worth surfacing when it's coming up, just never as overdue.
const NO_OVERDUE_ALERT_KEYS = new Set(["eval_presentation_day"]);

export function urgentTasks(c: Case): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 2);

  const severityTier = (t: Task): number => {
    const overdue = new Date(t.due + "T00:00:00") < today;
    if (overdue && t.milestone) return 0;
    if (overdue) return 1;
    if (t.milestone) return 2;
    return 3;
  };

  return c.tasks
    .filter((t) => {
      if (t.done) return false;
      // 招標公告／投標截止 are fixed calendar time points, not tasks the team can act on or fall
      // behind on — they should never surface as a 警示提醒/alert, just appear on the calendar.
      if (isNonCheckableTask(t)) return false;
      const due = new Date(t.due + "T00:00:00");
      if (due > soon) return false;
      if (due < today && t.key && NO_OVERDUE_ALERT_KEYS.has(t.key)) return false;
      return true;
    })
    .sort((a, b) => {
      const tierDiff = severityTier(a) - severityTier(b);
      if (tierDiff !== 0) return tierDiff;
      return new Date(a.due).getTime() - new Date(b.due).getTime();
    });
}

export function caseProgress(c: Case): { doneCount: number; total: number; pct: number } {
  const checkable = c.tasks.filter((t) => !isNonCheckableTask(t));
  const doneCount = checkable.filter((t) => t.done).length;
  const pct = checkable.length ? Math.round((doneCount / checkable.length) * 100) : 0;
  return { doneCount, total: checkable.length, pct };
}

// Manually-linked tasks (see ListView.tsx's 連結任務 dropdown) follow their target's due date +
// linkOffsetDays. Called from AppContext's updateCase after every mutation so links stay
// resolved regardless of which UI surface moved the target task. Bounded pass count instead of
// cycle detection — a user-made link cycle just stops updating rather than looping forever.
export function resolveLinkedTaskDates(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (const t of tasks) {
      if (!t.linkedTaskId || t.linkedTaskId === t.id) continue;
      const target = byId.get(t.linkedTaskId);
      if (!target) continue; // dangling link (target deleted) — leave due as-is
      const offset = t.linkOffsetDays ?? 0;
      const wanted = toISO(snapToBizDay(addDays(new Date(target.due + "T00:00:00"), offset)));
      if (t.due !== wanted) {
        t.due = wanted;
        t.autoDue = wanted;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return tasks;
}

// Mirrors the server-side check in src/lib/caseMapper.ts (which operates on the raw DB row) —
// this is the client-facing version, operating on the mapped Case shape.
export function canEditCase(c: Case, userId: string | null): boolean {
  return c.bidLeadUserId === null || c.bidLeadUserId === userId;
}
