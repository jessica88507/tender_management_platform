import { addDays, toISO } from "./date";
import type { Case, Task } from "./types";

export type MilestoneStatus = "done" | "overdue" | "upcoming";

export type MilestoneItem = {
  id: string;
  label: string;
  due: string;
  status: MilestoneStatus;
};

// Milestones are now fully user-editable (any task can be starred as 大事記 in ListView), so this
// just lists whatever tasks currently have `milestone` set — no more fixed 9-slot assumption.
export function buildMilestoneList(c: Case): MilestoneItem[] {
  const todayIso = toISO(new Date());
  return c.tasks
    .filter((t) => t.milestone)
    .map((t) => ({
      id: t.id,
      label: t.label,
      due: t.due,
      status: (t.done ? "done" : t.due < todayIso ? "overdue" : "upcoming") as MilestoneStatus,
    }))
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

export function overdueTasks(c: Case): Task[] {
  const todayIso = toISO(new Date());
  return c.tasks
    .filter((t) => !t.done && t.due < todayIso)
    .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

export type CalendarDay = {
  date: number;
  iso: string;
  isToday: boolean;
  inMonth: boolean;
  tasks: Task[];
};

export type CalendarMonth = {
  monthLabel: string;
  weeks: CalendarDay[][];
};

function buildMonthGrid(year: number, month: number, tasksByDate: Record<string, Task[]>, todayIso: string): CalendarMonth {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);

  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd = new Date(lastOfMonth);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: CalendarDay[][] = [];
  let cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const iso = toISO(cursor);
      week.push({
        date: cursor.getDate(),
        iso,
        isToday: iso === todayIso,
        inMonth: cursor.getMonth() === month,
        tasks: (tasksByDate[iso] || []).slice().sort((a, b) => (b.milestone ? 1 : 0) - (a.milestone ? 1 : 0)),
      });
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  return { monthLabel: `${year} 年 ${month + 1} 月`, weeks };
}

// One CalendarMonth per month spanning the case's full working range — same range the app's own
// CalendarView uses (earliest of workStart/tenderStart, through 30 days past the deadline for the
// evaluation-stage buffer) — so the report's calendar slides cover everything the app shows.
export function buildAllMonthsCalendars(c: Case): CalendarMonth[] {
  const workStart = new Date(c.workStart + "T00:00:00");
  const tenderStart = new Date(c.start + "T00:00:00");
  const deadlineDT = new Date(c.deadline);
  const deadline = new Date(deadlineDT.getFullYear(), deadlineDT.getMonth(), deadlineDT.getDate());
  const rangeStart = workStart < tenderStart ? workStart : tenderStart;
  const rangeEnd = addDays(deadline, 30);

  const tasksByDate: Record<string, Task[]> = {};
  c.tasks.forEach((t) => {
    (tasksByDate[t.due] = tasksByDate[t.due] || []).push(t);
  });
  const todayIso = toISO(new Date());

  const months: CalendarMonth[] = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
  while (cursor <= endMonth) {
    months.push(buildMonthGrid(cursor.getFullYear(), cursor.getMonth(), tasksByDate, todayIso));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}
