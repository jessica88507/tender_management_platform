export type Consultant = {
  role: string;
  company: string;
  contact: string;
  affiliation: string;
  custom: boolean;
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
  meetingWeekday: number;
  contractAmount: number;
  siteArea: number;
  floorArea: number;
  floorCount: string;
  weekNotes: Record<string, string>;
  team: Team;
  tasks: Task[];
};

export type AppState = {
  cases: Record<string, Case>;
  lastActiveId: string | null;
};

export type ViewMode = "cal" | "list";
