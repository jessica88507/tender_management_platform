export type TeamGroup = "architect" | "jianguo" | "extra" | null;

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
  // The architect branch's own org-chart title (e.g. the partner firm's name) — a dedicated field,
  // not derived from `architect[0]`, so naming the team isn't tangled up with listing its members.
  architectName: string;
  architect: string[];
  mep: string[];
  // Optional 3rd org-chart branch (e.g. a JV MEP company handling this case's 機電) — empty
  // `extraName` with no members means the branch simply doesn't render; unlike 建國工程團隊 (always
  // the firm's own fixed in-house team), this one is per-case and user-named like the architect
  // branch.
  extraName: string;
  extraMembers: string[];
  consultants: Consultant[];
};

export type Task = {
  id: string;
  // Template key this task was generated from (see taskTemplates.ts), used to match tasks across
  // regenerations without overwriting manual edits. Null for tasks that predate this field or
  // were added by hand.
  key?: string | null;
  cat: string;
  label: string;
  note: string;
  owner: string;
  due: string; // YYYY-MM-DD
  // Last value the scheduling engine computed for `due`. If `due !== autoDue`, the task's date
  // has been manually adjusted and a non-destructive regenerate must leave it alone.
  autoDue?: string | null;
  done: boolean;
  milestone: string | null;
  // Manual link to another task in the same case — this task's `due` follows the linked task's
  // `due` + linkOffsetDays whenever the target moves (see ListView.tsx's 連結任務 dropdown).
  // A dangling id (target since deleted) is simply treated as "no link".
  linkedTaskId?: string | null;
  linkOffsetDays?: number | null;
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
  tenderType: string; // 標案形式（統包工程／私人案）
  contractMode: string; // 契約模式（最有利標／最低價）
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

export type ViewMode = "cal" | "list" | "both";
