import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { cases, consultants, tasks, teamMembers, users, weekNotes } from "@/db/schema";
import { canEditCase } from "@/lib/caseMapper";
import type { Case } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.query.cases.findFirst({ where: eq(cases.id, id) });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditCase(existing, session.user.id)) {
    return NextResponse.json({ error: "此案件已由其他主投標手認領，你目前僅有唯讀權限" }, { status: 403 });
  }

  const body = (await request.json()) as Case;

  // 主投標手 always mirrors the actual owning account's real name — never trusted as free text
  // from the client. Default: the case is "claimed" by whoever is editing it, if nobody owns it
  // yet (ownerId stays session.user.id). The current owner may instead reassign it to a
  // different real member account (excluding admins) via body.bidLeadUserId.
  let ownerId = existing.bidLeadUserId ?? session.user.id;
  let ownerName = session.user.name ?? "";
  if (body.bidLeadUserId && body.bidLeadUserId !== ownerId) {
    const targetUser = await db.query.users.findFirst({ where: eq(users.id, body.bidLeadUserId) });
    if (!targetUser || targetUser.role !== "member") {
      return NextResponse.json({ error: "指定的主投標手不存在或不可指派" }, { status: 400 });
    }
    ownerId = targetUser.id;
    ownerName = targetUser.name ?? "";
  }

  await db.transaction(async (tx) => {
    await tx
      .update(cases)
      .set({
        name: body.name,
        workStart: body.workStart,
        tenderStart: body.start,
        deadline: body.deadline,
        bidLeadName: ownerName,
        bidLeadUserId: ownerId,
        meetingWeekday: body.meetingWeekday,
        contractAmount: String(body.contractAmount ?? 0),
        siteArea: body.siteArea ?? 0,
        floorArea: body.floorArea ?? 0,
        floorCount: body.floorCount ?? "",
        ownerOrg: body.ownerOrg ?? "",
        userUnit: body.userUnit ?? "",
        location: body.location ?? "",
        contractMode: body.contractMode ?? "",
        contractScope: body.contractScope ?? "",
        supervisorUnit: body.supervisorUnit ?? "",
        buildingType: body.buildingType ?? "",
        constructionPeriod: body.constructionPeriod ?? "",
        specialNotes: body.specialNotes ?? "",
        categoryOrder: body.categoryOrder ?? null,
        updatedAt: new Date(),
      })
      .where(eq(cases.id, id));

    await tx.delete(tasks).where(eq(tasks.caseId, id));
    await tx.delete(teamMembers).where(eq(teamMembers.caseId, id));
    await tx.delete(consultants).where(eq(consultants.caseId, id));
    await tx.delete(weekNotes).where(eq(weekNotes.caseId, id));

    if (body.team?.architect?.length || body.team?.mep?.length) {
      await tx.insert(teamMembers).values([
        ...(body.team.architect ?? []).map((name, i) => ({ caseId: id, kind: "architect" as const, name, sortIndex: i })),
        ...(body.team.mep ?? []).map((name, i) => ({ caseId: id, kind: "mep" as const, name, sortIndex: i })),
      ]);
    }
    if (body.team?.consultants?.length) {
      await tx.insert(consultants).values(
        body.team.consultants.map((c, i) => ({
          caseId: id,
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
    if (body.tasks?.length) {
      await tx.insert(tasks).values(
        body.tasks.map((t, i) => ({
          caseId: id,
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
    const noteEntries = Object.entries(body.weekNotes ?? {});
    if (noteEntries.length) {
      await tx.insert(weekNotes).values(noteEntries.map(([weekStart, note]) => ({ caseId: id, weekStart, note })));
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.query.cases.findFirst({ where: eq(cases.id, id) });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canEditCase(existing, session.user.id)) {
    return NextResponse.json({ error: "只有主投標手能刪除這個案件" }, { status: 403 });
  }

  await db.delete(cases).where(eq(cases.id, id));
  return NextResponse.json({ ok: true });
}
