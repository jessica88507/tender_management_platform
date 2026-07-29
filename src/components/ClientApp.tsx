"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { ArrowUp, FolderOpen } from "@phosphor-icons/react";
import { AppProvider, useApp } from "@/context/AppContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { MainView } from "@/components/MainView";
import { ProjectManagerModal } from "@/components/ProjectManagerModal";
import { LoginScreen } from "@/components/LoginScreen";
import { AdminShell } from "@/components/AdminShell";

function AppShell({
  userName,
  department,
}: {
  userName?: string | null;
  department?: string | null;
}) {
  const { setActiveId, loading } = useApp();
  const [explicitNew, setExplicitNew] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setShowBackToTop(el.scrollTop > 400);
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [loading]);

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Header userName={userName} department={department} onSignOut={() => signOut()} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          onShowNew={() => {
            setActiveId(null);
            setExplicitNew(true);
          }}
        />
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-ink-soft text-[18px]">載入案件資料中…</div>
        ) : (
          <MainView explicitNew={explicitNew} onCaseMounted={() => setExplicitNew(false)} mainRef={mainRef} />
        )}
      </div>
      <button
        onClick={() => setShowManager(true)}
        className="fixed left-4.5 bottom-4.5 z-[500] bg-ink text-card border-none py-3 px-5 rounded-3xl text-[18px] font-bold cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.3)] hover:bg-primary flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
      >
        <FolderOpen weight="fill" size={16} />
        專案管理
      </button>
      <button
        onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
        title="回到頂部"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
        className={
          "fixed right-4.5 bottom-4.5 z-[500] w-11 h-11 rounded-full bg-ink text-card border-none cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.3)] hover:bg-primary flex items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight transition-opacity duration-200 " +
          (showBackToTop ? "opacity-100" : "opacity-0 pointer-events-none")
        }
      >
        <ArrowUp weight="bold" size={18} />
      </button>
      {showManager && <ProjectManagerModal onClose={() => setShowManager(false)} />}
    </div>
  );
}

const THEME_KEY = "bid-scheduler-theme";

export default function ClientApp() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;
    // The blocking init script (see layout.tsx) always starts the page on light, since it runs
    // before we know whether anyone's signed in. Once the session check resolves, apply the
    // signed-in user's own saved preference — or fall back to light on the login screen itself.
    // Per the user's explicit choice, light is always the default (including for a user who's
    // never touched the toggle) — dark is opt-in only via the in-app toggle, never guessed from
    // the OS/browser's own dark-mode setting.
    try {
      const saved = session ? window.localStorage.getItem(THEME_KEY) : null;
      document.documentElement.setAttribute("data-theme", saved === "dark" ? "dark" : "light");
    } catch {
      // localStorage unavailable — the initial light default from layout.tsx just stays as-is
    }
  }, [status, session]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-background text-ink-soft text-[18px]">載入中…</div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (session.user?.role === "admin") {
    return (
      <ConfirmProvider>
        <AdminShell userName={session.user?.name} />
      </ConfirmProvider>
    );
  }

  return (
    <ConfirmProvider>
      <AppProvider>
        <AppShell userName={session.user?.name} department={session.user?.department} />
      </AppProvider>
    </ConfirmProvider>
  );
}
