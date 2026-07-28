"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Header } from "@/components/Header";
import { AdminSidebar, type AdminSection } from "@/components/AdminSidebar";
import { MembersPanel } from "@/components/MembersPanel";
import { AdminProjectsPanel } from "@/components/AdminProjectsPanel";
import { TaskTemplatesPanel } from "@/components/TaskTemplatesPanel";

export function AdminShell({ userName }: { userName?: string | null }) {
  const [section, setSection] = useState<AdminSection>("members");

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Header userName={userName} department="系統管理員" onSignOut={() => signOut()} />
      <div className="flex flex-1 min-h-0">
        <AdminSidebar section={section} onSelect={setSection} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {section === "members" ? (
            <MembersPanel />
          ) : section === "projects" ? (
            <AdminProjectsPanel />
          ) : (
            <TaskTemplatesPanel />
          )}
        </div>
      </div>
    </div>
  );
}
