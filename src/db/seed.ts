import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { cases, consultants, teamMembers, tasks, users, weekNotes } from "./schema";
import { generateTasks } from "../lib/scheduler";
import { CONSULTANT_DEFAULTS } from "../lib/constants";
import type { Case } from "../lib/types";

const DEMO_EMAIL = "demo.lead@example.com";
const DEMO_PASSWORD = "bidprep2026";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "admin2026";

async function main() {
  console.log("Seeding...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const existing = await db.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
  const user = existing
    ? (await db.update(users).set({ passwordHash }).where(eq(users.id, existing.id)).returning())[0]
    : (
        await db
          .insert(users)
          .values({ email: DEMO_EMAIL, name: "陳志明", department: "業務部", passwordHash })
          .returning()
      )[0];

  console.log(`Demo login -> email: ${DEMO_EMAIL} / password: ${DEMO_PASSWORD}`);

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const existingAdmin = await db.query.users.findFirst({ where: eq(users.email, ADMIN_EMAIL) });
  if (existingAdmin) {
    await db.update(users).set({ passwordHash: adminPasswordHash, role: "admin" }).where(eq(users.id, existingAdmin.id));
  } else {
    await db.insert(users).values({ email: ADMIN_EMAIL, name: "系統管理員", passwordHash: adminPasswordHash, role: "admin" });
  }
  console.log(`Admin login -> email: ${ADMIN_EMAIL} / password: ${ADMIN_PASSWORD}`);

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
      caseId: createdCase.id,
      cat: t.cat,
      label: t.label,
      note: t.note,
      owner: t.owner,
      due: t.due,
      done: t.done,
      milestone: t.milestone,
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
