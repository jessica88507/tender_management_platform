import { Case } from "./types";
import { daysBetween } from "./date";

export function caseDaysLeft(c: Case): number {
  return daysBetween(new Date(), new Date(c.deadline));
}

export function caseProgress(c: Case): { doneCount: number; pct: number } {
  const doneCount = c.tasks.filter((t) => t.done).length;
  const pct = c.tasks.length ? Math.round((doneCount / c.tasks.length) * 100) : 0;
  return { doneCount, pct };
}
