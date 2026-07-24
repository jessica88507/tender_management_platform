"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { CaseView } from "@/components/CaseView";
import { NewCaseForm } from "@/components/NewCaseForm";

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

export function MainView({
  explicitNew,
  onCaseMounted,
}: {
  explicitNew: boolean;
  onCaseMounted: () => void;
}) {
  const { activeId, state } = useApp();
  const showForm = !activeId || !state.cases[activeId];

  return (
    <main className="flex-1 py-8 px-11 pb-15 max-w-[1240px] overflow-y-auto">
      {showForm ? (
        <NewCaseForm showEmptyState={!explicitNew} />
      ) : (
        <CaseViewWrapper caseId={activeId!} onMount={onCaseMounted} />
      )}
    </main>
  );
}
