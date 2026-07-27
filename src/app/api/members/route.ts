import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

// Minimal member directory (id + name only, admins excluded) for the 主投標手 reassignment
// dropdown in InfoPanel — any authenticated member can read this, unlike the full /api/users
// listing which stays admin-only.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.users.findMany({
    where: eq(users.role, "member"),
    columns: { id: true, name: true },
    orderBy: [asc(users.name)],
  });

  return NextResponse.json({ members: rows });
}
