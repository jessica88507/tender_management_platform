import { TAIWAN_HOLIDAY_SET } from "./holidays";

export function uid(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISO(d: Date): string {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function isHoliday(d: Date): boolean {
  const key = d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  return TAIWAN_HOLIDAY_SET.has(key);
}

// Moves a computed date backward until it lands on a real business day (not Sat/Sun, not a
// Taiwan public holiday — see holidays.ts) — schedule estimates should always be conservative,
// so this only ever moves earlier, never later.
export function snapToBizDay(date: Date): Date {
  const d = new Date(date);
  for (let i = 0; i < 20 && (d.getDay() === 0 || d.getDay() === 6 || isHoliday(d)); i++) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

// Business-day (Mon–Fri, non-holiday) counterparts of daysBetween/addDays — a percentage-of-work-
// period rule (see scheduler.ts's ratio-kind rows and 提出釋疑) should measure "工期" in actual
// working days, not calendar days, so weekends/holidays inside the range don't inflate it.
export function businessDaysBetween(a: Date, b: Date): number {
  let count = 0;
  const d = new Date(a);
  while (d < b) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !isHoliday(d)) count++;
  }
  return count;
}

export function subtractBusinessDays(date: Date, n: number): Date {
  const d = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !isHoliday(d)) remaining--;
  }
  return d;
}

export function addBusinessDays(date: Date, n: number): Date {
  const d = new Date(date);
  let remaining = n;
  while (remaining > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6 && !isHoliday(d)) remaining--;
  }
  return d;
}

export function fmtWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const w = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${dateStr.slice(5)} (${w})`;
}
