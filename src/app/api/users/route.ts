import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db.query.users.findMany({
    columns: { id: true, name: true, username: true, department: true, role: true, createdAt: true },
    orderBy: [asc(users.createdAt)],
  });

  return NextResponse.json({ users: rows });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    name?: string;
    username?: string;
    password?: string;
    department?: string;
  };

  const name = body.name?.trim() || "";
  const username = body.username?.trim() || "";
  const password = body.password || "";
  const department = body.department?.trim() || "業務部";

  if (!name || !username || !password) {
    return NextResponse.json({ error: "姓名、帳號、密碼皆為必填" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "密碼至少需 6 個字元" }, { status: 400 });
  }

  const existing = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (existing) {
    return NextResponse.json({ error: "此帳號已被使用" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [created] = await db
    .insert(users)
    .values({ name, username, department, passwordHash, role: "member" })
    .returning({ id: users.id, name: users.name, username: users.username, department: users.department, role: users.role, createdAt: users.createdAt });

  return NextResponse.json({ user: created });
}
