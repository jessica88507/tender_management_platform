import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { cases, consultants, tasks, teamMembers, weekNotes } from "@/db/schema";
import { rowToCase } from "@/lib/caseMapper";
import { generateTasks, normalizeCase, normalizeTeam } from "@/lib/scheduler";
import type { Case } from "@/lib/types";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.cases.findMany({
    with: { tasks: true, teamMembers: true, consultants: true, weekNotes: true },
  });

  const result: Record<string, Case> = {};
  rows.forEach((row) => {
    result[row.id] = rowToCase(row);
  });

  return NextResponse.json({ cases: result });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { name?: string; start?: string; deadline?: string };
  if (!body.start || !body.deadline) {
    return NextResponse.json({ error: "start and deadline are required" }, { status: 400 });
  }

  const draft: Case = {
    name: body.name?.trim() || "未命名案件",
    workStart: body.start,
    start: body.start,
    deadline: body.deadline,
    bidLead: session.user.name ?? "",
    bidLeadUserId: session.user.id,
    meetingWeekday: 2,
    contractAmount: 0,
    siteArea: 0,
    floorArea: 0,
    floorCount: "",
    weekNotes: {},
    team: normalizeTeam(undefined),
    tasks: [],
  };
  normalizeCase(draft);
  draft.tasks = generateTasks(draft);

  const newCase = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(cases)
      .values({
        name: draft.name,
        workStart: draft.workStart,
        tenderStart: draft.start,
        deadline: draft.deadline,
        bidLeadName: draft.bidLead,
        bidLeadUserId: session.user.id,
        createdByUserId: session.user.id,
        meetingWeekday: draft.meetingWeekday,
        contractAmount: String(draft.contractAmount),
        siteArea: draft.siteArea,
        floorArea: draft.floorArea,
        floorCount: draft.floorCount,
      })
      .returning();

    if (draft.team.architect.length || draft.team.mep.length) {
      await tx.insert(teamMembers).values([
        ...draft.team.architect.map((name, i) => ({ caseId: created.id, kind: "architect" as const, name, sortIndex: i })),
        ...draft.team.mep.map((name, i) => ({ caseId: created.id, kind: "mep" as const, name, sortIndex: i })),
      ]);
    }
    if (draft.team.consultants.length) {
      await tx.insert(consultants).values(
        draft.team.consultants.map((c, i) => ({
          caseId: created.id,
          role: c.role,
          company: c.company,
          contact: c.contact,
          affiliation: c.affiliation,
          isCustom: c.custom,
          teamGroup: c.team,
          sortIndex: i,
        }))
      );
    }
    if (draft.tasks.length) {
      await tx.insert(tasks).values(
        draft.tasks.map((t, i) => ({
          caseId: created.id,
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
    }
    const noteEntries = Object.entries(draft.weekNotes);
    if (noteEntries.length) {
      await tx.insert(weekNotes).values(noteEntries.map(([weekStart, note]) => ({ caseId: created.id, weekStart, note })));
    }

    return created;
  });

  return NextResponse.json({ id: newCase.id, case: draft });
}
