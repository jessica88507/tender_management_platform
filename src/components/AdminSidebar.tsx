"use client";

import { FolderOpen, ListChecks, Users } from "@phosphor-icons/react";

export type AdminSection = "members" | "projects" | "templates";

export function AdminSidebar({
  section,
  onSelect,
}: {
  section: AdminSection;
  onSelect: (section: AdminSection) => void;
}) {
  const items: { key: AdminSection; label: string; icon: typeof Users }[] = [
    { key: "members", label: "系統成員", icon: Users },
    { key: "projects", label: "專案管理", icon: FolderOpen },
    { key: "templates", label: "預設排程規則", icon: ListChecks },
  ];

  return (
    <div className="w-14 sm:w-[230px] shrink-0 py-7 pr-0 pl-2 sm:pl-4.5 border-r border-border overflow-y-auto overflow-x-hidden">
      {items.map(({ key, label, icon: Icon }) => {
        const isActive = key === section;
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            title={label}
            className={
              "flex items-center justify-center sm:justify-start gap-2.5 w-full text-left rounded-l-lg py-3 pr-0 sm:pr-3.5 pl-0 sm:pl-4 mb-2 cursor-pointer text-[19px] font-bold transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
              (isActive
                ? "bg-card text-ink sm:-translate-x-1 shadow-[-2px_2px_0_var(--shadow-tab)] border border-r-0 border-accent"
                : "bg-background text-ink-soft border border-r-0 border-border hover:bg-muted")
            }
          >
            <Icon weight={isActive ? "fill" : "bold"} size={17} className="shrink-0" />
            <span className="hidden sm:inline truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
