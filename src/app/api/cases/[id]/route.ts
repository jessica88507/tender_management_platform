import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { cases, consultants, tasks, teamMembers, users, weekNotes } from "@/db/schema";
import type { Case } from "@/lib/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.query.cases.findFirst({ where: eq(cases.id, id) });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Anyone may edit any case now (the client warns non-owners before saving) — ownership itself
  // is untouched below unless the case was unclaimed, so a non-owner's edit never silently
  // takes over the case.

  const body = (await request.json()) as Case;

  // Optimistic concurrency check: the client echoes back the `updatedAt` it last saw. If that no
  // longer matches the row (someone else — another tab, another person — saved in between), this
  // PATCH is built from stale local state and would silently clobber their newer save. Reject it
  // instead; the client re-fetches this case fresh rather than overwriting. Cases opened in a tab
  // from before this field existed send no `updatedAt` — skip the check for those rather than
  // hard-failing every save until every open tab happens to reload.
  if (body.updatedAt && new Date(body.updatedAt).getTime() !== new Date(existing.updatedAt).getTime()) {
    return NextResponse.json(
      { error: "這個案件已被其他分頁或其他人儲存過較新的內容，為避免覆蓋掉它，這次儲存已取消，請重新整理頁面。", conflict: true },
      { status: 409 }
    );
  }

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

  const savedAt = new Date();
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
        tenderType: body.tenderType ?? "",
        contractMode: body.contractMode ?? "",
        contractScope: body.contractScope ?? "",
        supervisorUnit: body.supervisorUnit ?? "",
        buildingType: body.buildingType ?? "",
        constructionPeriod: body.constructionPeriod ?? "",
        specialNotes: body.specialNotes ?? "",
        architectTeamName: body.team?.architectName ?? "",
        extraTeamName: body.team?.extraName ?? "",
        categoryOrder: body.categoryOrder ?? null,
        updatedAt: savedAt,
      })
      .where(eq(cases.id, id));

    await tx.delete(tasks).where(eq(tasks.caseId, id));
    await tx.delete(teamMembers).where(eq(teamMembers.caseId, id));
    await tx.delete(consultants).where(eq(consultants.caseId, id));
    await tx.delete(weekNotes).where(eq(weekNotes.caseId, id));

    if (body.team?.architect?.length || body.team?.mep?.length || body.team?.extraMembers?.length) {
      await tx.insert(teamMembers).values([
        ...(body.team.architect ?? []).map((name, i) => ({ caseId: id, kind: "architect" as const, name, sortIndex: i })),
        ...(body.team.mep ?? []).map((name, i) => ({ caseId: id, kind: "mep" as const, name, sortIndex: i })),
        ...(body.team.extraMembers ?? []).map((name, i) => ({ caseId: id, kind: "extra" as const, name, sortIndex: i })),
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
          id: t.id,
          caseId: id,
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
    }
    const noteEntries = Object.entries(body.weekNotes ?? {});
    if (noteEntries.length) {
      await tx.insert(weekNotes).values(noteEntries.map(([weekStart, note]) => ({ caseId: id, weekStart, note })));
    }
  });

  return NextResponse.json({ ok: true, updatedAt: savedAt.toISOString() });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Only the system administrator may delete a case now — regular members (including a case's own
  // 主投標手) no longer have any delete affordance in the UI at all; enforced here too so this
  // can't be triggered by a direct API call either.
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "只有系統管理員能刪除案件" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await db.query.cases.findFirst({ where: eq(cases.id, id) });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.delete(cases).where(eq(cases.id, id));
  return NextResponse.json({ ok: true });
}
