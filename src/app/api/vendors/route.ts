import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { vendorDirectory } from "@/db/schema";

export type VendorRow = {
  id: string;
  role: string;
  company: string;
  contact: string;
  phone: string;
  email: string;
  notes: string;
};

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.vendorDirectory.findMany({ orderBy: (v, { asc }) => [asc(v.role), asc(v.company)] });
  return NextResponse.json({ vendors: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Partial<VendorRow>;
  if (!body.role?.trim()) {
    return NextResponse.json({ error: "請填寫角色/專業類別" }, { status: 400 });
  }

  const [created] = await db
    .insert(vendorDirectory)
    .values({
      role: body.role.trim(),
      company: body.company?.trim() ?? "",
      contact: body.contact?.trim() ?? "",
      phone: body.phone?.trim() ?? "",
      email: body.email?.trim() ?? "",
      notes: body.notes?.trim() ?? "",
    })
    .returning();

  return NextResponse.json({ vendor: created });
}
