import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { cases, consultants, teamMembers, tasks, taskTemplates, users, weekNotes } from "./schema";
import { generateTasks } from "../lib/scheduler";
import { DEFAULT_TASK_TEMPLATES } from "../lib/taskTemplates";
import { CONSULTANT_DEFAULTS } from "../lib/constants";
import type { Case } from "../lib/types";

const DEMO_EMAIL = "demo.lead@example.com";
const DEMO_USERNAME = "demo.lead";
const DEMO_PASSWORD = "bidprep2026";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin2026";

async function main() {
  console.log("Seeding...");

  // Backfill username for any pre-existing account created before login switched from email to
  // username (e.g. members added via MembersPanel in an earlier session) — derives it from the
  // email's local-part so those accounts don't get silently locked out.
  await db.execute(
    sql`update ${users} set username = split_part(email, '@', 1) where username is null and email is not null`
  );

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const existing = await db.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
  const user = existing
    ? (await db.update(users).set({ passwordHash, username: DEMO_USERNAME }).where(eq(users.id, existing.id)).returning())[0]
    : (
        await db
          .insert(users)
          .values({ username: DEMO_USERNAME, email: DEMO_EMAIL, name: "陳志明", department: "業務部", passwordHash })
          .returning()
      )[0];

  console.log(`Demo login -> username: ${DEMO_USERNAME} / password: ${DEMO_PASSWORD}`);

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existingAdmin = await db.query.users.findFirst({ where: eq(users.username, ADMIN_USERNAME) });
  if (existingAdmin) {
    await db.update(users).set({ passwordHash: adminPasswordHash, role: "admin" }).where(eq(users.id, existingAdmin.id));
  } else {
    await db.insert(users).values({ username: ADMIN_USERNAME, name: "系統管理員", passwordHash: adminPasswordHash, role: "admin" });
  }
  console.log(`Admin login -> username: ${ADMIN_USERNAME} / password: ${ADMIN_PASSWORD}`);

  const backfilled = await db.query.users.findMany({
    where: sql`${users.username} is not null`,
    columns: { username: true, email: true, name: true },
  });
  console.log(
    "All accounts (username -> name):",
    backfilled.map((u) => `${u.username} (${u.name ?? u.email ?? "?"})`).join(", ")
  );

  await db.delete(taskTemplates);
  await db.insert(taskTemplates).values(
    DEFAULT_TASK_TEMPLATES.map((t) => ({
      key: t.key,
      sortIndex: t.sortIndex,
      category: t.category,
      label: t.label,
      owner: t.owner,
      enabled: t.enabled,
      kind: t.kind,
      anchor: t.anchor ?? null,
      anchorTaskKey: t.anchorTaskKey ?? null,
      offsetDays: t.offsetDays ?? null,
      ratioPct: t.ratioPct ?? null,
      snap: t.snap ?? true,
      milestone: t.milestone ?? null,
      note: t.note ?? "",
    }))
  );
  console.log(`Seeded ${DEFAULT_TASK_TEMPLATES.length} default task templates.`);

  const caseData: Case = {
    name: "114年台北市立圖書館分館新建工程統包案",
    workStart: "2026-07-28",
    start: "2026-08-04",
    deadline: "2026-11-06T10:00",
    bidLead: user.name ?? "陳志明",
    bidLeadUserId: user.id,
    meetingWeekday: 2,
    contractAmount: 9200000000,
    siteArea: 3200,
    floorArea: 18500,
    floorCount: "地上12層/地下3層",
    ownerOrg: "台北市立圖書館",
    userUnit: "台北市立圖書館",
    location: "台北市內湖區文湖段",
    tenderType: "統包工程",
    contractMode: "最有利標",
    contractScope: "建築+機電工程+設計",
    supervisorUnit: "台灣世曦工程顧問股份有限公司",
    buildingType: "一幢一棟／地上12層地下3層",
    constructionPeriod: "決標後900日竣工（30個月）",
    specialNotes: "綠建築銀級以上、智慧建築合格級以上、無障礙住宅建築標章",
    weekNotes: {
      "2026-08-02": "確認顧問團隊委託書用印進度",
    },
    team: {
      architect: ["林建成", "許雅婷"],
      mep: ["王政豪"],
      consultants: CONSULTANT_DEFAULTS.map((role, i) => ({
        id: `seed-consultant-${i}`,
        role,
        company: i === 0 ? "永固結構技師事務所" : "",
        contact: i === 0 ? "張哲維" : "",
        affiliation: i === 0 ? "建國" : "",
        custom: false,
        team: i === 0 ? ("jianguo" as const) : null,
      })),
    },
    tasks: [],
  };
  caseData.tasks = generateTasks(caseData);

  // Clear any previous seed run so this script stays idempotent.
  await db.delete(cases).where(eq(cases.createdByUserId, user.id));

  const [createdCase] = await db
    .insert(cases)
    .values({
      name: caseData.name,
      workStart: caseData.workStart,
      tenderStart: caseData.start,
      deadline: caseData.deadline,
      bidLeadName: caseData.bidLead,
      bidLeadUserId: user.id,
      createdByUserId: user.id,
      meetingWeekday: caseData.meetingWeekday,
      contractAmount: String(caseData.contractAmount),
      siteArea: caseData.siteArea,
      floorArea: caseData.floorArea,
      floorCount: caseData.floorCount,
      ownerOrg: caseData.ownerOrg,
      userUnit: caseData.userUnit,
      location: caseData.location,
      tenderType: caseData.tenderType,
      contractMode: caseData.contractMode,
      contractScope: caseData.contractScope,
      supervisorUnit: caseData.supervisorUnit,
      buildingType: caseData.buildingType,
      constructionPeriod: caseData.constructionPeriod,
      specialNotes: caseData.specialNotes,
    })
    .returning();

  await db.insert(teamMembers).values([
    ...caseData.team.architect.map((name, i) => ({
      caseId: createdCase.id,
      kind: "architect" as const,
      name,
      sortIndex: i,
    })),
    ...caseData.team.mep.map((name, i) => ({
      caseId: createdCase.id,
      kind: "mep" as const,
      name,
      sortIndex: i,
    })),
  ]);

  await db.insert(consultants).values(
    caseData.team.consultants.map((c, i) => ({
      caseId: createdCase.id,
      role: c.role,
      company: c.company,
      contact: c.contact,
      affiliation: c.affiliation,
      isCustom: c.custom,
      teamGroup: c.team,
      sortIndex: i,
    }))
  );

  await db.insert(weekNotes).values(
    Object.entries(caseData.weekNotes).map(([weekStart, note]) => ({
      caseId: createdCase.id,
      weekStart,
      note,
    }))
  );

  await db.insert(tasks).values(
    caseData.tasks.map((t, i) => ({
      id: t.id,
      caseId: createdCase.id,
      key: t.key ?? null,
      cat: t.cat,
      label: t.label,
      note: t.note,
      owner: t.owner,
      due: t.due,
      autoDue: t.autoDue ?? null,
      done: t.done,
      milestone: t.milestone,
      linkedTaskId: t.linkedTaskId ?? null,
      linkOffsetDays: t.linkOffsetDays ?? null,
      sortIndex: i,
    }))
  );

  console.log(`Seeded case ${createdCase.id} ("${createdCase.name}") with ${caseData.tasks.length} tasks.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
