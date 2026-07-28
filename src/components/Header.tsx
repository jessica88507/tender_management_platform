"use client";

import { SignOut, UserCircle } from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header({
  userName,
  department,
  onSignOut,
}: {
  userName?: string | null;
  department?: string | null;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-3 h-16 shrink-0 px-4 sm:px-6 bg-card border-b-2 border-ink overflow-hidden">
      <div className="font-serif font-black text-[23.5px] sm:text-[26px] tracking-wide flex items-baseline gap-2 min-w-0 shrink-0">
        <span className="whitespace-nowrap">業務投標管理平台</span>
        <span className="hidden md:inline font-mono text-[13px] font-semibold text-ink-soft tracking-[0.2em] whitespace-nowrap">
          BIGMASTER
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 min-w-0 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-[19px] text-ink-soft min-w-0">
          <UserCircle weight="fill" size={22} className="text-steel shrink-0" />
          <span className="truncate max-w-[140px]">{userName ?? "使用者"}</span>
          {department && <span className="text-ink-soft/70 whitespace-nowrap">・{department}</span>}
        </div>
        <ThemeToggle />
        <button
          onClick={onSignOut}
          title="登出"
          className="flex items-center gap-1.5 border-[1.5px] border-accent text-accent py-1.5 px-2.5 sm:px-3 rounded-md text-[19px] font-bold cursor-pointer hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary shrink-0 whitespace-nowrap"
        >
          <SignOut weight="bold" size={16} />
          <span className="hidden sm:inline">登出</span>
        </button>
      </div>
    </header>
  );
}
