import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { vendorDirectory } from "@/db/schema";
import type { VendorRow } from "../route";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json()) as Partial<VendorRow>;

  if ("role" in body && !body.role?.trim()) {
    return NextResponse.json({ error: "請填寫角色/專業類別" }, { status: 400 });
  }

  // Each field is saved independently on blur (see VendorDirectoryModal's saveField), so `body`
  // is only ever a single-key partial — only touch keys actually present, or every other save
  // clobbers the rest of the row back to "".
  const patch: Partial<typeof vendorDirectory.$inferInsert> = { updatedAt: new Date() };
  const fields = ["role", "company", "contact", "phone", "email", "notes"] as const;
  for (const key of fields) {
    if (key in body) patch[key] = body[key]?.trim() ?? "";
  }

  const [updated] = await db.update(vendorDirectory).set(patch).where(eq(vendorDirectory.id, id)).returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ vendor: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(vendorDirectory).where(eq(vendorDirectory.id, id));
  return NextResponse.json({ ok: true });
}
