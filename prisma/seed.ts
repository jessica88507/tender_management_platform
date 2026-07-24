import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateTasks } from "../src/lib/scheduler";
import { CONSULTANT_DEFAULTS } from "../src/lib/constants";
import type { Case } from "../src/lib/types";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding...");

  const user = await prisma.user.upsert({
    where: { email: "demo.lead@example.com" },
    update: {},
    create: {
      email: "demo.lead@example.com",
      name: "陳志明",
      department: "業務部",
    },
  });

  const caseData: Case = {
    name: "114年台北市立圖書館分館新建工程統包案",
    workStart: "2026-07-28",
    start: "2026-08-04",
    deadline: "2026-11-06T10:00",
    bidLead: user.name ?? "陳志明",
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
  await prisma.case.deleteMany({ where: { createdByUserId: user.id } });

  const createdCase = await prisma.case.create({
    data: {
      name: caseData.name,
      workStart: new Date(caseData.workStart),
      tenderStart: new Date(caseData.start),
      deadline: new Date(caseData.deadline),
      bidLeadName: caseData.bidLead,
      bidLeadUserId: user.id,
      createdByUserId: user.id,
      meetingWeekday: caseData.meetingWeekday,
      contractAmount: caseData.contractAmount,
      siteArea: caseData.siteArea,
      floorArea: caseData.floorArea,
      floorCount: caseData.floorCount,
      teamMembers: {
        create: [
          ...caseData.team.architect.map((name, i) => ({
            kind: "architect" as const,
            name,
            sortIndex: i,
          })),
          ...caseData.team.mep.map((name, i) => ({
            kind: "mep" as const,
            name,
            sortIndex: i,
          })),
        ],
      },
      consultants: {
        create: caseData.team.consultants.map((c, i) => ({
          role: c.role,
          company: c.company,
          contact: c.contact,
          affiliation: c.affiliation,
          isCustom: c.custom,
          teamGroup: c.team,
          sortIndex: i,
        })),
      },
      weekNotes: {
        create: Object.entries(caseData.weekNotes).map(([weekStart, note]) => ({
          weekStart: new Date(weekStart),
          note,
        })),
      },
      tasks: {
        create: caseData.tasks.map((t, i) => ({
          cat: t.cat,
          label: t.label,
          owner: t.owner,
          due: new Date(t.due),
          done: t.done,
          milestone: t.milestone,
          sortIndex: i,
        })),
      },
    },
  });

  console.log(`Seeded case ${createdCase.id} ("${createdCase.name}") with ${caseData.tasks.length} tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
