export type TeamGroup = "architect" | "jianguo" | null;

export type Consultant = {
  id: string;
  role: string;
  company: string;
  contact: string;
  affiliation: string;
  custom: boolean;
  team: TeamGroup;
};

export type Team = {
  architect: string[];
  mep: string[];
  consultants: Consultant[];
};

export type Task = {
  id: string;
  cat: string;
  label: string;
  note: string;
  owner: string;
  due: string; // YYYY-MM-DD
  done: boolean;
  milestone: string | null;
};

export type Case = {
  name: string;
  workStart: string; // YYYY-MM-DD
  start: string; // YYYY-MM-DD (招標公告)
  deadline: string; // YYYY-MM-DDTHH:MM
  bidLead: string;
  // null = unclaimed (anyone can edit and becomes the claimant on next save); otherwise only this
  // user may edit/delete the case — everyone else gets read-only. See canEditCase in derived.ts.
  bidLeadUserId: string | null;
  meetingWeekday: number;
  contractAmount: number;
  siteArea: number;
  floorArea: number;
  floorCount: string;
  // Drag-reordered display order of task categories in 任務清單; null/undefined = default order.
  categoryOrder?: string[] | null;
  weekNotes: Record<string, string>;
  team: Team;
  tasks: Task[];
};

export type AppState = {
  cases: Record<string, Case>;
  lastActiveId: string | null;
};

export type ViewMode = "cal" | "list";
