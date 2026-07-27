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
  mainRef,
}: {
  explicitNew: boolean;
  onCaseMounted: () => void;
  mainRef?: React.RefObject<HTMLElement | null>;
}) {
  const { activeId, state } = useApp();
  const showForm = !activeId || !state.cases[activeId];

  return (
    <main ref={mainRef} className="flex-1 overflow-y-auto">
      <div className="max-w-[1240px] py-5 px-4 pb-10 sm:py-8 sm:px-11 sm:pb-15">
        {showForm ? (
          <NewCaseForm showEmptyState={!explicitNew} />
        ) : (
          <CaseViewWrapper caseId={activeId!} onMount={onCaseMounted} />
        )}
      </div>
    </main>
  );
}
