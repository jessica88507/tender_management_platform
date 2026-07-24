"use client";

import { SignOut, UserCircle } from "@phosphor-icons/react";

export function Header({ onSignOut }: { onSignOut: () => void }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between h-16 shrink-0 px-6 bg-paper-light border-b-2 border-ink">
      <div className="font-serif font-black text-lg tracking-wide flex items-baseline gap-2">
        備標控台
        <span className="font-mono text-[10px] font-semibold text-ink-soft tracking-[0.2em]">BID PREP CONTROL</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[13px] text-ink-soft">
          <UserCircle weight="fill" size={20} className="text-steel" />
          業務部人員
        </div>
        <button
          onClick={onSignOut}
          title="登出"
          className="flex items-center gap-1.5 border-[1.5px] border-tab-brown text-tab-brown py-1.5 px-3 rounded-md text-[13px] font-bold cursor-pointer hover:bg-tab-brown/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chop-red"
        >
          <SignOut weight="bold" size={15} />
          登出
        </button>
      </div>
    </header>
  );
}
