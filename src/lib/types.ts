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
  // 案件基本資料 fields modeled after the company's real bid-proposal deck format.
  ownerOrg: string; // 業主
  userUnit: string; // 使用單位
  location: string; // 地點
  contractMode: string; // 契約模式
  contractScope: string; // 承攬範圍
  supervisorUnit: string; // 監造單位
  buildingType: string; // 建築形式
  constructionPeriod: string; // 合約工期
  specialNotes: string; // 特殊說明
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
