import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTaskTemplateRows, replaceTaskTemplateRows } from "@/lib/taskTemplatesServer";
import { TaskTemplateRow } from "@/lib/taskTemplates";

// GET: any authenticated user (member or admin) — generateTasks() needs the live rule set to
// compute a new case's/regenerated schedule client-side and server-side alike.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await getTaskTemplateRows();
  return NextResponse.json({ templates });
}

// PATCH: admin-only — the super-admin's 預設排程規則 editor writes the full rule set back.
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as { templates?: TaskTemplateRow[] };
  if (!Array.isArray(body.templates) || body.templates.length === 0) {
    return NextResponse.json({ error: "templates 為必填且不可為空" }, { status: 400 });
  }

  for (const t of body.templates) {
    if (!t.key || !t.category || !t.label || !t.kind) {
      return NextResponse.json({ error: "每筆規則需包含 key、category、label、kind" }, { status: 400 });
    }
    if (t.kind === "fixed" && !t.anchor && !t.anchorTaskKey) {
      return NextResponse.json({ error: `規則「${t.label}」為 fixed 類型時需指定 anchor` }, { status: 400 });
    }
  }

  await replaceTaskTemplateRows(body.templates);
  return NextResponse.json({ ok: true });
}
