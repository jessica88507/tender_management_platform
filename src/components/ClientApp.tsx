"use client";

import { useState } from "react";
import { FolderOpen } from "@phosphor-icons/react";
import { AppProvider, useApp } from "@/context/AppContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { MainView } from "@/components/MainView";
import { ProjectManagerModal } from "@/components/ProjectManagerModal";
import { LoginScreen } from "@/components/LoginScreen";

function AppShell({ onSignOut }: { onSignOut: () => void }) {
  const { setActiveId } = useApp();
  const [explicitNew, setExplicitNew] = useState(false);
  const [showManager, setShowManager] = useState(false);

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <Header onSignOut={onSignOut} />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          onShowNew={() => {
            setActiveId(null);
            setExplicitNew(true);
          }}
        />
        <MainView explicitNew={explicitNew} onCaseMounted={() => setExplicitNew(false)} />
      </div>
      <button
        onClick={() => setShowManager(true)}
        className="fixed left-4.5 bottom-4.5 z-[500] bg-ink text-paper-light border-none py-3 px-5 rounded-3xl text-sm font-bold cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.3)] hover:bg-chop-red flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
      >
        <FolderOpen weight="fill" size={16} />
        專案管理
      </button>
      {showManager && <ProjectManagerModal onClose={() => setShowManager(false)} />}
    </div>
  );
}

export default function ClientApp() {
  const [signedIn, setSignedIn] = useState(false);

  if (!signedIn) {
    return <LoginScreen onSignIn={() => setSignedIn(true)} />;
  }

  return (
    <ConfirmProvider>
      <AppProvider>
        <AppShell onSignOut={() => setSignedIn(false)} />
      </AppProvider>
    </ConfirmProvider>
  );
}
