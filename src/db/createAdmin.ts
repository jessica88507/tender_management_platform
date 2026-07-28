import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";

// Bootstraps just one admin account — unlike db:seed, this never touches task_templates or
// cases, so it's safe to run against a real production database that already has real users/
// task-template customizations you don't want wiped. Override the defaults via env vars when
// running against production so you're not leaving the well-known demo password in place.
const USERNAME = process.env.ADMIN_USERNAME || "admin";
const PASSWORD = process.env.ADMIN_PASSWORD || "admin2026";

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await db.query.users.findFirst({ where: eq(users.username, USERNAME) });

  if (existing) {
    await db.update(users).set({ passwordHash, role: "admin" }).where(eq(users.id, existing.id));
    console.log(`Updated existing account -> username: ${USERNAME} (now admin, password reset)`);
  } else {
    await db.insert(users).values({ username: USERNAME, name: "系統管理員", passwordHash, role: "admin" });
    console.log(`Created admin account -> username: ${USERNAME} / password: ${PASSWORD}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
