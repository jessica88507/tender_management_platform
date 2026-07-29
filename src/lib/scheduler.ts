import { Case, Task, Team } from "./types";
import { addBusinessDays, addDays, businessDaysBetween, snapToBizDay, subtractBusinessDays, toISO, uid } from "./date";
import { CONSULTANT_DEFAULTS, WEEKDAY_NAMES } from "./constants";
import { DEFAULT_TASK_TEMPLATES, TaskTemplateRow, mergeTemplates } from "./taskTemplates";

export function normalizeTeam(team: Partial<Team> | undefined): Team {
  const t: Team = {
    architect: team?.architect ?? [],
    mep: team?.mep ?? [],
    consultants: (team?.consultants ?? []).map((item) =>
      typeof item === "string"
        ? { id: uid(), role: item, company: "", contact: "", affiliation: "", custom: true, team: null }
        : {
            id: item.id ?? uid(),
            role: item.role,
            company: item.company ?? "",
            contact: item.contact ?? "",
            affiliation: item.affiliation ?? "",
            custom: item.custom ?? true,
            team: item.team ?? null,
          }
    ),
  };
  // Only seed the 13 default roles when the team has no consultants at all (brand-new case, or a
  // case that's had every consultant removed) — this runs on every case open (see CaseView.tsx),
  // so backfilling by role-name match whenever one's "missing" would silently resurrect any
  // default the user deliberately deleted, making delete look broken.
  if (t.consultants.length === 0) {
    CONSULTANT_DEFAULTS.forEach((role) => {
      t.consultants.push({ id: uid(), role, company: "", contact: "", affiliation: "", custom: false, team: null });
    });
  }
  return t;
}

export function normalizeCase(c: Case): Case {
  if (!c.workStart) c.workStart = c.start;
  if (c.bidLead === undefined) c.bidLead = "";
  return c;
}

export function getOwnerOptions(c: Case): string[] {
  const opts: string[] = [];
  if (c.bidLead) opts.push(c.bidLead);
  (c.team.architect || []).forEach((n) => n && opts.push(n));
  (c.team.mep || []).forEach((n) => n && opts.push(n));
  (c.team.consultants || []).forEach((row) => row.contact && opts.push(row.contact));
  ["業主", "估算部", "模型資訊部", "建築師", "機電團隊", "備標團隊"].forEach((x) => opts.push(x));
  return Array.from(new Set(opts));
}

function generateRecurringMeetings(start: Date, deadlineDate: Date, weekday: number): Date[] {
  const first = new Date(start);
  first.setDate(first.getDate() + 3);
  while (first.getDay() !== weekday) first.setDate(first.getDate() + 1);
  const last = addDays(deadlineDate, -7);
  const arr: Date[] = [];
  const cur = new Date(first);
  while (cur <= last && arr.length < 20) {
    arr.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return arr;
}

export function generateTasks(c: Case, templateOverrides?: TaskTemplateRow[] | null): Task[] {
  const start = new Date(c.start + "T00:00:00");
  // 開始作業期程 (internal work-prep start) vs 招標公告 (public tender announcement) — two
  // distinct anchor dates; defaults to the same day as `start` until edited separately in
  // InfoPanel (see normalizeCase), so most cases see no change from using this anchor.
  const workStartDate = new Date((c.workStart || c.start) + "T00:00:00");
  const deadlineDT = new Date(c.deadline);
  const deadlineDate = new Date(deadlineDT.getFullYear(), deadlineDT.getMonth(), deadlineDT.getDate());
  const tasks: Task[] = [];

  const templates = mergeTemplates(templateOverrides);
  const byKey = new Map(templates.map((t) => [t.key, t]));
  const resolve = (key: string) => byKey.get(key);

  const add = (
    cat: string,
    label: string,
    owner: string,
    dateObj: Date,
    milestone?: string | null,
    key?: string
  ) => {
    tasks.push({
      id: uid(),
      key: key || null,
      cat,
      label,
      note: "",
      owner: owner || c.bidLead || "",
      due: toISO(dateObj),
      autoDue: toISO(dateObj),
      done: false,
      milestone: milestone || null,
    });
  };
  // Emits a task from a template row by key, honoring its enabled flag; used for "special" rows
  // whose date logic can't be reduced to a plain anchor+offset or deadline-ratio.
  const addT = (key: string, dateObj: Date, ownerOverride?: string) => {
    const tpl = resolve(key);
    if (!tpl || tpl.enabled === false) return;
    add(tpl.category, tpl.label, ownerOverride ?? tpl.owner, dateObj, tpl.milestone ?? null, key);
    computedDates.set(key, dateObj);
  };
  const later = (a: Date, b: Date) => (a.getTime() > b.getTime() ? a : b);
  const anchorDate = (anchor: TaskTemplateRow["anchor"]) =>
    anchor === "workStart" ? workStartDate : anchor === "deadline" ? deadlineDate : start;

  // Dates of every key'd task computed so far, keyed by template key — lets a "fixed" row anchor
  // itself to another task (anchorTaskKey) instead of only the 3 case-level dates. Populated by
  // addT (special rows) as they run, and by resolveFixedDate (memoized, cycle-guarded) below.
  const computedDates = new Map<string, Date>();
  const resolvingKeys = new Set<string>();
  function resolveFixedDate(key: string): Date | null {
    if (computedDates.has(key)) return computedDates.get(key)!;
    if (resolvingKeys.has(key)) return null; // cycle guard — admin misconfigured a loop
    const tpl = byKey.get(key);
    if (!tpl || tpl.enabled === false || tpl.kind !== "fixed") return null; // can only chain through fixed rows
    resolvingKeys.add(key);
    const base = tpl.anchorTaskKey ? resolveFixedDate(tpl.anchorTaskKey) : anchorDate(tpl.anchor);
    resolvingKeys.delete(key);
    if (!base) return null;
    const shifted = addDays(base, tpl.offsetDays ?? 0);
    const dateObj = tpl.snap === false ? shifted : snapToBizDay(shifted);
    computedDates.set(key, dateObj);
    return dateObj;
  }

  // Business days only (excludes weekends + Taiwan public holidays) — a percentage-of-工期 rule
  // shouldn't count days nobody is actually working.
  const totalDaysForRatio = Math.max(businessDaysBetween(start, deadlineDate), 1);

  // ---- "special" rows: hardcoded date logic, but label/category/owner/enabled still come
  // from the template above. Runs before the generic "fixed"/"ratio" loop below so that a fixed
  // row's anchorTaskKey can point at any of these (eng_signoff, master, cost_final, ...), not
  // just other fixed rows. ----

  const weekday =
    c.meetingWeekday !== undefined && c.meetingWeekday !== null ? Number(c.meetingWeekday) : 2;
  const meetingDates = generateRecurringMeetings(start, deadlineDate, weekday);
  const meetingTpl = resolve("meeting_recurring");
  if (meetingTpl && meetingTpl.enabled !== false) {
    meetingDates.forEach((d, i) =>
      add(
        meetingTpl.category,
        `${meetingTpl.label}${String(i + 1).padStart(2, "0")}（${WEEKDAY_NAMES[weekday]}）`,
        meetingTpl.owner,
        d,
        null,
        // Each instance needs its own stable key so InfoPanel's "依目前設定調整排程" regen (see
        // handleRegen) can actually match and replace them — without this, changing 例行會議固定星期
        // and regenerating just added a fresh set of meetings on the new weekday alongside the old
        // ones forever (no key ⇒ treated as an untouchable manual/orphaned task, never replaced).
        `meeting_recurring_${i + 1}`
      )
    );
  }

  const wuDate = snapToBizDay(addDays(start, 14));

  // Always a single meeting, regardless of contract amount, held at least 7 days before the
  // deadline (and never before 吳董設計會議+5 days, same ordering guard as before).
  const preBidDate = snapToBizDay(later(addDays(deadlineDate, -7), addDays(wuDate, 5)));
  const prebidTpl = resolve("prebid");
  if (prebidTpl && prebidTpl.enabled !== false) {
    add(prebidTpl.category, prebidTpl.label, prebidTpl.owner, preBidDate, "prebid", "prebid");
  }
  const firstPreBid = preBidDate;
  const lastPreBid = preBidDate;

  // Kind is "fixed" (anchorTaskKey: "prebid") so the offset is admin-editable, but it's still
  // computed here rather than left to the generic fixed-kind loop below, since notarize (right
  // after) needs engSignoffDate synchronously — see the loop's explicit eng_signoff exclusion.
  const engSignoffTpl = resolve("eng_signoff");
  const engSignoffDate = snapToBizDay(addDays(lastPreBid, engSignoffTpl?.offsetDays ?? -1));
  addT("eng_signoff", engSignoffDate);

  // 需要在工程事業簽呈之後（至少晚1天），且仍以投標截止前4天為基準。
  addT("notarize", snapToBizDay(later(addDays(deadlineDate, -4), addDays(engSignoffDate, 1))));

  // 建築師提供平立面／剖面／門窗表／外觀材質：以例行會議＃2為獨立錨點，會議後1~2天。
  const meeting2 = meetingDates[1] || meetingDates[0] || addDays(start, 10);
  const architectDeliver = snapToBizDay(addDays(meeting2, 2));
  const estimateStart = snapToBizDay(addDays(architectDeliver, 1));
  const estimateEnd = snapToBizDay(addDays(estimateStart, 14));
  addT("architect_deliver", architectDeliver);
  addT("estimate_start", estimateStart);
  addT("estimate_end", estimateEnd);

  // 招標公告後7~10天內，通常在例行會議#1之後。
  const masterBase = snapToBizDay(addDays(start, 8));
  const meeting1 = meetingDates[0];
  const masterDate = meeting1 ? snapToBizDay(later(masterBase, addDays(meeting1, 1))) : masterBase;
  addT("master", masterDate);
  const targetPoint = addDays(masterDate, 11);
  const meetingForDraft =
    meetingDates.find((d) => d >= targetPoint) || meetingDates[meetingDates.length - 1] || targetPoint;
  addT("draft", snapToBizDay(addDays(meetingForDraft, -1)));
  addT("proof1", snapToBizDay(meetingForDraft));

  addT("cost_final", snapToBizDay(addDays(firstPreBid, -3)));

  // 送件投標：依投標截止的時間點決定是前一天還是同一天 — cutoff is exactly 10:00 (per the
  // template's note text), compared at minute precision so e.g. 09:20 and 10:00 land correctly
  // on either side of it.
  const deadlineMinutes = deadlineDT.getHours() * 60 + deadlineDT.getMinutes();
  const submitBase = deadlineMinutes < 10 * 60 ? addDays(deadlineDate, -1) : deadlineDate;
  addT("submit_action", snapToBizDay(submitBase));

  // 招標公告後工期25%（工期＝扣除例假日與國定假日的工作天數，從招標公告起算），再往後抓最近的工作日。
  addT("rfi", snapToBizDay(addBusinessDays(start, Math.round(totalDaysForRatio * 0.25))));

  // ---- Generic "fixed" (anchor + offsetDays) and "ratio" (% of total duration before
  // deadline) rows — fully data-driven from the templates, no special-case logic needed. ----
  templates
    // eng_signoff is "fixed" (so its offset is admin-editable) but already added above in the
    // special section — notarize needs its date synchronously, before this loop runs — so it's
    // excluded here to avoid pushing the task twice.
    .filter((t) => t.kind === "fixed" && t.enabled !== false && t.key !== "eng_signoff")
    .forEach((t) => {
      const dateObj = resolveFixedDate(t.key) ?? snapToBizDay(addDays(anchorDate(t.anchor), t.offsetDays ?? 0));
      add(t.category, t.label, t.owner, dateObj, t.milestone ?? null, t.key);
    });
  templates
    .filter((t) => t.kind === "ratio" && t.enabled !== false)
    .forEach((t) => {
      const pct = t.ratioPct ?? 0;
      const dateObj = snapToBizDay(subtractBusinessDays(deadlineDate, Math.round((pct / 100) * totalDaysForRatio)));
      add(t.category, t.label, t.owner, dateObj, t.milestone ?? null, t.key);
      computedDates.set(t.key, dateObj);
    });

  return tasks.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime());
}

export { DEFAULT_TASK_TEMPLATES };
export type { TaskTemplateRow };
