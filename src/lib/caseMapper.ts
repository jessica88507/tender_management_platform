import type { Case, Consultant, Task } from "./types";

// Shape returned by `db.query.cases.findFirst/findMany({ with: { tasks: true, teamMembers: true,
// consultants: true, weekNotes: true } })` — kept loose (not importing Drizzle's inferred types)
// so this module only needs to know about the fields it actually reads.
type CaseRow = {
  id: string;
  name: string;
  workStart: string;
  tenderStart: string;
  deadline: string;
  bidLeadName: string;
  bidLeadUserId: string | null;
  meetingWeekday: number;
  contractAmount: string;
  siteArea: number;
  floorArea: number;
  floorCount: string;
  categoryOrder: string[] | null;
  createdByUserId: string | null;
  tasks: {
    id: string;
    cat: string;
    label: string;
    note: string;
    owner: string;
    due: string;
    done: boolean;
    milestone: string | null;
  }[];
  teamMembers: { id: string; kind: "architect" | "mep"; name: string; sortIndex: number }[];
  consultants: {
    id: string;
    role: string;
    company: string;
    contact: string;
    affiliation: string;
    isCustom: boolean;
    teamGroup: "architect" | "jianguo" | null;
    sortIndex: number;
  }[];
  weekNotes: { weekStart: string; note: string }[];
};

export function rowToCase(row: CaseRow): Case {
  const tasks: Task[] = row.tasks.map((t) => ({
    id: t.id,
    cat: t.cat,
    label: t.label,
    note: t.note,
    owner: t.owner,
    due: t.due,
    done: t.done,
    milestone: t.milestone,
  }));

  const consultants: Consultant[] = [...row.consultants]
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((c) => ({
      id: c.id,
      role: c.role,
      company: c.company,
      contact: c.contact,
      affiliation: c.affiliation,
      custom: c.isCustom,
      team: c.teamGroup,
    }));

  const architect = row.teamMembers
    .filter((m) => m.kind === "architect")
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((m) => m.name);
  const mep = row.teamMembers
    .filter((m) => m.kind === "mep")
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((m) => m.name);

  const weekNotes: Record<string, string> = {};
  row.weekNotes.forEach((w) => {
    weekNotes[w.weekStart] = w.note;
  });

  return {
    name: row.name,
    workStart: row.workStart,
    start: row.tenderStart,
    deadline: row.deadline,
    bidLead: row.bidLeadName,
    bidLeadUserId: row.bidLeadUserId,
    meetingWeekday: row.meetingWeekday,
    contractAmount: Number(row.contractAmount),
    siteArea: row.siteArea,
    floorArea: row.floorArea,
    floorCount: row.floorCount,
    categoryOrder: row.categoryOrder,
    weekNotes,
    team: { architect, mep, consultants },
    tasks,
  };
}

export function canEditCase(row: { bidLeadUserId: string | null }, userId: string): boolean {
  return row.bidLeadUserId === null || row.bidLeadUserId === userId;
}
