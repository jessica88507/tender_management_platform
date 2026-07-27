import { Case, Task } from "./types";
import { daysBetween } from "./date";

export function caseDaysLeft(c: Case): number {
  return daysBetween(new Date(), new Date(c.deadline));
}

// Not-done tasks due within 2 days (including overdue). Sorted by severity tier first — overdue
// 大事記 (milestones) rank above everything else, then overdue non-milestones, then upcoming
// milestones, then upcoming non-milestones — and by due date ascending within each tier.
// Shared by AlertBanner (renders the list) and CaseView (decides whether to reserve a right
// column for it at all) so the two never drift out of sync.
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
      const due = new Date(t.due + "T00:00:00");
      return due <= soon;
    })
    .sort((a, b) => {
      const tierDiff = severityTier(a) - severityTier(b);
      if (tierDiff !== 0) return tierDiff;
      return new Date(a.due).getTime() - new Date(b.due).getTime();
    });
}

export function caseProgress(c: Case): { doneCount: number; pct: number } {
  const doneCount = c.tasks.filter((t) => t.done).length;
  const pct = c.tasks.length ? Math.round((doneCount / c.tasks.length) * 100) : 0;
  return { doneCount, pct };
}

// Mirrors the server-side check in src/lib/caseMapper.ts (which operates on the raw DB row) —
// this is the client-facing version, operating on the mapped Case shape.
export function canEditCase(c: Case, userId: string | null): boolean {
  return c.bidLeadUserId === null || c.bidLeadUserId === userId;
}
