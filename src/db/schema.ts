import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const uuid = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());

// ---------- Auth (NextAuth.js / Auth.js Drizzle adapter shape) ----------
// Standard Auth.js Postgres+Drizzle table shape, extended with `department` (gates login to
// 業務部), `passwordHash` (credentials login, until Microsoft Entra ID SSO is wired up), and
// `role` (system-admin accounts bypass the department gate and get member/project management).

export const userRoleEnum = pgEnum("user_role", ["member", "admin"]);

export const users = pgTable("users", {
  id: uuid(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  department: text("department"),
  passwordHash: text("password_hash"),
  role: userRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ---------- Domain ----------

export const teamGroupEnum = pgEnum("team_group", ["architect", "jianguo"]);
export const simpleTeamKindEnum = pgEnum("simple_team_kind", ["architect", "mep"]);

export const cases = pgTable(
  "cases",
  {
    id: uuid(),
    name: text("name").notNull(),

    workStart: date("work_start", { mode: "string" }).notNull(),
    tenderStart: date("tender_start", { mode: "string" }).notNull(),
    // Stored as the exact 'YYYY-MM-DDTHH:MM' string from the datetime-local input — this app is
    // timezone-naive throughout (single-timezone usage, like the original spec), so a `timestamp`
    // column here would risk silent off-by-timezone bugs depending on the DB/server's local TZ.
    deadline: text("deadline").notNull(),

    // 主投標手：free-text display name (scheduling-engine default) + optional link to the
    // logged-in user who owns edit rights on this case.
    bidLeadName: text("bid_lead_name").notNull().default(""),
    bidLeadUserId: text("bid_lead_user_id").references(() => users.id, { onDelete: "set null" }),

    meetingWeekday: integer("meeting_weekday").notNull().default(2),
    contractAmount: numeric("contract_amount", { precision: 18, scale: 0 }).notNull().default("0"),
    siteArea: doublePrecision("site_area").notNull().default(0),
    floorArea: doublePrecision("floor_area").notNull().default(0),
    floorCount: text("floor_count").notNull().default(""),

    // 案件基本資料 fields modeled after the company's real bid-proposal deck format.
    ownerOrg: text("owner_org").notNull().default(""), // 業主
    userUnit: text("user_unit").notNull().default(""), // 使用單位
    location: text("location").notNull().default(""), // 地點
    contractMode: text("contract_mode").notNull().default(""), // 契約模式（如：統包，總價承攬）
    contractScope: text("contract_scope").notNull().default(""), // 承攬範圍（如：建築+機電工程+設計）
    supervisorUnit: text("supervisor_unit").notNull().default(""), // 監造單位
    buildingType: text("building_type").notNull().default(""), // 建築形式（棟數／地上地下層數）
    constructionPeriod: text("construction_period").notNull().default(""), // 合約工期
    specialNotes: text("special_notes").notNull().default(""), // 特殊說明（認證／審查等）

    // User-customized display order of task categories (A–F) in 任務清單, drag-reordered as
    // whole blocks. Null/absent means "use the default CATEGORIES order" (see ListView.tsx).
    categoryOrder: text("category_order").array(),

    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("cases_bid_lead_user_id_idx").on(t.bidLeadUserId)]
);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),

    cat: text("cat").notNull(),
    label: text("label").notNull(),
    note: text("note").notNull().default(""),
    owner: text("owner").notNull().default(""),
    due: date("due", { mode: "string" }).notNull(),
    done: boolean("done").notNull().default(false),
    milestone: text("milestone"),

    // Optional per-task Outlook calendar sync (see project spec item 5)
    syncToOutlook: boolean("sync_to_outlook").notNull().default(false),
    outlookEventId: text("outlook_event_id"),

    sortIndex: integer("sort_index").notNull().default(0),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("tasks_case_id_idx").on(t.caseId), index("tasks_case_id_due_idx").on(t.caseId, t.due)]
);

// 建築師 / 機電團隊 simple name lists (per case)
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    kind: simpleTeamKindEnum("kind").notNull(),
    name: text("name").notNull(),
    sortIndex: integer("sort_index").notNull().default(0),
  },
  (t) => [index("team_members_case_id_idx").on(t.caseId)]
);

// 專業顧問，可拖曳分類到 建築師團隊 / 建國工程團隊
export const consultants = pgTable(
  "consultants",
  {
    id: uuid(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    company: text("company").notNull().default(""),
    contact: text("contact").notNull().default(""),
    affiliation: text("affiliation").notNull().default(""),
    isCustom: boolean("is_custom").notNull().default(true),
    teamGroup: teamGroupEnum("team_group"),
    sortIndex: integer("sort_index").notNull().default(0),
  },
  (t) => [index("consultants_case_id_idx").on(t.caseId)]
);

// 行事曆檢視「本週目標/備注」欄位
export const weekNotes = pgTable(
  "week_notes",
  {
    id: uuid(),
    caseId: text("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    weekStart: date("week_start", { mode: "string" }).notNull(),
    note: text("note").notNull().default(""),
  },
  (t) => [uniqueIndex("week_notes_case_week_idx").on(t.caseId, t.weekStart)]
);

// ---------- Relations (for the relational query API) ----------

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  leadCases: many(cases, { relationName: "bidLead" }),
  createdCases: many(cases, { relationName: "createdBy" }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  bidLead: one(users, { fields: [cases.bidLeadUserId], references: [users.id], relationName: "bidLead" }),
  createdBy: one(users, { fields: [cases.createdByUserId], references: [users.id], relationName: "createdBy" }),
  tasks: many(tasks),
  teamMembers: many(teamMembers),
  consultants: many(consultants),
  weekNotes: many(weekNotes),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  case: one(cases, { fields: [tasks.caseId], references: [cases.id] }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  case: one(cases, { fields: [teamMembers.caseId], references: [cases.id] }),
}));

export const consultantsRelations = relations(consultants, ({ one }) => ({
  case: one(cases, { fields: [consultants.caseId], references: [cases.id] }),
}));

export const weekNotesRelations = relations(weekNotes, ({ one }) => ({
  case: one(cases, { fields: [weekNotes.caseId], references: [cases.id] }),
}));
