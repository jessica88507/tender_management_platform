"use client";

import { useEffect, useState } from "react";
import { FolderOpen } from "@phosphor-icons/react";
import { AppProvider, useApp } from "@/context/AppContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { Sidebar } from "@/components/Sidebar";
import { CaseView } from "@/components/CaseView";
import { NewCaseForm } from "@/components/NewCaseForm";
import { ProjectManagerModal } from "@/components/ProjectManagerModal";
import { LoginScreen } from "@/components/LoginScreen";

function AppShell() {
  const { activeId, state, setActiveId } = useApp();
  const [explicitNew, setExplicitNew] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const showForm = !activeId || !state.cases[activeId];

  return (
    <div className="flex min-h-screen">
      <Sidebar
        onShowNew={() => {
          setActiveId(null);
          setExplicitNew(true);
        }}
      />
      <div className="flex-1 py-8 px-11 pb-15 max-w-[1240px]">
        {showForm ? (
          <NewCaseForm showEmptyState={!explicitNew} />
        ) : (
          <CaseViewWrapper caseId={activeId!} onMount={() => setExplicitNew(false)} />
        )}
      </div>
      <button
        onClick={() => setShowManager(true)}
        className="fixed left-4.5 bottom-4.5 z-[500] bg-ink text-paper-light border-none py-3 px-5 rounded-3xl text-sm font-bold cursor-pointer shadow-[0_4px_14px_rgba(0,0,0,0.3)] hover:bg-chop-red flex items-center gap-2"
      >
        <FolderOpen weight="fill" size={16} />
        專案管理
      </button>
      {showManager && <ProjectManagerModal onClose={() => setShowManager(false)} />}
    </div>
  );
}

function CaseViewWrapper({ caseId, onMount }: { caseId: string; onMount: () => void }) {
  const { state } = useApp();
  useEffect(() => {
    onMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);
  const c = state.cases[caseId];
  if (!c) return null;
  return <CaseView caseId={caseId} caseData={c} />;
}

export default function ClientApp() {
  const [signedIn, setSignedIn] = useState(false);

  if (!signedIn) {
    return <LoginScreen onSignIn={() => setSignedIn(true)} />;
  }

  return (
    <ConfirmProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ConfirmProvider>
  );
}
