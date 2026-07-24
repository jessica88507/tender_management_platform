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

export function snapToBizDay(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() - 1);
  else if (day === 0) d.setDate(d.getDate() - 2);
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
}

export function fmtWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const w = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${dateStr.slice(5)} (${w})`;
}
