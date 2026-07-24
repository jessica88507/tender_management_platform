"use client";

import { useEffect, useState } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { ConfirmProvider } from "@/context/ConfirmContext";
import { Sidebar } from "@/components/Sidebar";
import { CaseView } from "@/components/CaseView";
import { NewCaseForm } from "@/components/NewCaseForm";
import { ProjectManagerModal } from "@/components/ProjectManagerModal";

function AppShell() {
  const { activeId, state, setActiveId } = useApp();
  const [explicitNew, setExplicitNew] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const showForm = !activeId || !state.cases[activeId];

  return (
    <div className="app">
      <Sidebar
        onShowNew={() => {
          setActiveId(null);
          setExplicitNew(true);
        }}
      />
      <div className="main">
        {showForm ? (
          <NewCaseForm showEmptyState={!explicitNew} />
        ) : (
          <CaseViewWrapper caseId={activeId!} onMount={() => setExplicitNew(false)} />
        )}
      </div>
      <button className="pm-fab" onClick={() => setShowManager(true)}>
        🗂 專案管理
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
  return (
    <ConfirmProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ConfirmProvider>
  );
}
