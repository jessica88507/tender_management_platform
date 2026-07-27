import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as {
    name?: string;
    email?: string;
    password?: string;
    department?: string;
  };

  const name = body.name?.trim() || "";
  const email = body.email?.trim().toLowerCase() || "";
  const department = body.department?.trim() || "";
  const password = body.password || "";

  if (!name || !email) {
    return NextResponse.json({ error: "姓名、電子郵件皆為必填" }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json({ error: "密碼至少需 6 個字元" }, { status: 400 });
  }

  const emailTaken = await db.query.users.findFirst({ where: and(eq(users.email, email), ne(users.id, id)) });
  if (emailTaken) {
    return NextResponse.json({ error: "此電子郵件已被使用" }, { status: 409 });
  }

  const [updated] = await db
    .update(users)
    .set({
      name,
      email,
      department,
      ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({ id: users.id, name: users.name, email: users.email, department: users.department, role: users.role, createdAt: users.createdAt });

  return NextResponse.json({ user: updated });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "無法刪除自己的帳號" }, { status: 400 });
  }

  await db.delete(users).where(eq(users.id, id));
  return NextResponse.json({ ok: true });
}
