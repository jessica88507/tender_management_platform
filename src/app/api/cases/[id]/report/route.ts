import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { cases } from "@/db/schema";
import { rowToCase } from "@/lib/caseMapper";
import { buildProjectPptx } from "@/lib/buildPptx";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await db.query.cases.findFirst({
    where: eq(cases.id, id),
    with: { tasks: true, teamMembers: true, consultants: true, weekNotes: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const c = rowToCase(row);
  const buffer = await buildProjectPptx(c);
  const filename = encodeURIComponent(`${c.name}_專案進度簡報.pptx`);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
    },
  });
}
