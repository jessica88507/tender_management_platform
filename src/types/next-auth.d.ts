import type { DefaultSession } from "next-auth";

export type UserRole = "member" | "admin";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      department: string | null;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    department?: string | null;
    role?: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    department?: string | null;
    role?: UserRole;
  }
}
