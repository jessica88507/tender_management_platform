"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AppState, Case, ViewMode } from "@/lib/types";
import { canEditCase } from "@/lib/derived";
import { useConfirm } from "@/context/ConfirmContext";

const LAST_ACTIVE_KEY = "bid-scheduler-last-active-id";

function emptyState(): AppState {
  return { cases: {}, lastActiveId: null };
}

type UIState = {
  viewMode: ViewMode;
  infoEditing: boolean;
  teamEditing: boolean;
  infoOpen: boolean;
  teamOpen: boolean;
};

type AppContextValue = {
  state: AppState;
  activeId: string | null;
  activeCase: Case | null;
  ui: UIState;
  loading: boolean;
  currentUserId: string | null;
  canEditActive: boolean;
  setActiveId: (id: string | null) => void;
  setViewMode: (v: ViewMode) => void;
  setInfoEditing: (v: boolean) => void;
  setTeamEditing: (v: boolean) => void;
  setInfoOpen: (v: boolean) => void;
  setTeamOpen: (v: boolean) => void;
  updateCase: (id: string, updater: (c: Case) => void) => void;
  createCase: (data: { name: string; start: string; deadline: string }) => void;
  deleteCase: (id: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { customAlert } = useConfirm();
  const { data: session } = useSession();
  const currentUserId = session?.user?.id ?? null;
  const [state, setState] = useState<AppState>(emptyState());
  const [activeId, setActiveIdRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [ui, setUi] = useState<UIState>({
    viewMode: "cal",
    infoEditing: false,
    teamEditing: false,
    infoOpen: false,
    teamOpen: false,
  });
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingSaves = useRef<Record<string, Case>>({});

  // Initial load: cases live in Postgres now, so this genuinely has to be a network fetch —
  // not something a lazy useState initializer can do synchronously (unlike the old localStorage
  // version). See docs/DECISIONS.md for why that distinction matters for the hooks-purity lint.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cases");
        if (!res.ok) throw new Error(`GET /api/cases failed: ${res.status}`);
        const data = (await res.json()) as { cases: Record<string, Case> };
        if (cancelled) return;
        setState({ cases: data.cases, lastActiveId: null });
        const lastActive = window.localStorage.getItem(LAST_ACTIVE_KEY);
        const initial = lastActive && data.cases[lastActive] ? lastActive : Object.keys(data.cases)[0] || null;
        setActiveIdRaw(initial);
      } catch (err) {
        console.error(err);
        await customAlert("讀取案件資料失敗，請重新整理頁面再試一次。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdRaw(id);
    setUi({ viewMode: "cal", infoEditing: false, teamEditing: false, infoOpen: false, teamOpen: false });
    try {
      if (id) window.localStorage.setItem(LAST_ACTIVE_KEY, id);
    } catch {
      // ignore storage errors
    }
  }, []);

  const persistCase = useCallback(
    (id: string, caseData: Case) => {
      pendingSaves.current[id] = caseData;
      if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(async () => {
        const payload = pendingSaves.current[id];
        delete pendingSaves.current[id];
        try {
          const res = await fetch(`/api/cases/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `PATCH failed: ${res.status}`);
          }
        } catch (err) {
          console.error(err);
          await customAlert(err instanceof Error ? err.message : "儲存失敗，請稍後再試。");
        }
      }, 400);
    },
    [customAlert]
  );

  const updateCase = useCallback(
    (id: string, updater: (c: Case) => void) => {
      setState((prev) => {
        const existing = prev.cases[id];
        if (!existing) return prev;
        const next: Case = JSON.parse(JSON.stringify(existing));
        updater(next);
        persistCase(id, next);
        return { ...prev, cases: { ...prev.cases, [id]: next } };
      });
    },
    [persistCase]
  );

  const createCase = useCallback(
    (data: { name: string; start: string; deadline: string }) => {
      (async () => {
        try {
          const res = await fetch("/api/cases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (!res.ok) throw new Error(`POST /api/cases failed: ${res.status}`);
          const { id, case: created } = (await res.json()) as { id: string; case: Case };
          setState((prev) => ({ ...prev, cases: { ...prev.cases, [id]: created } }));
          setActiveId(id);
          setUi({ viewMode: "cal", infoEditing: true, teamEditing: true, infoOpen: true, teamOpen: true });
        } catch (err) {
          console.error(err);
          await customAlert("建立案件失敗，請稍後再試。");
        }
      })();
    },
    [setActiveId, customAlert]
  );

  const deleteCase = useCallback(
    (id: string) => {
      setState((prev) => {
        const nextCases = { ...prev.cases };
        delete nextCases[id];
        return { ...prev, cases: nextCases };
      });
      setActiveIdRaw((prev) => (prev === id ? null : prev));
      (async () => {
        try {
          const res = await fetch(`/api/cases/${id}`, { method: "DELETE" });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `DELETE failed: ${res.status}`);
          }
        } catch (err) {
          console.error(err);
          await customAlert(err instanceof Error ? err.message : "刪除失敗，請稍後再試。");
        }
      })();
    },
    [customAlert]
  );

  const activeCase = activeId ? state.cases[activeId] ?? null : null;
  const canEditActive = activeCase ? canEditCase(activeCase, currentUserId) : true;

  const value: AppContextValue = {
    state,
    activeId,
    activeCase,
    ui,
    loading,
    currentUserId,
    canEditActive,
    setActiveId,
    setViewMode: (v) => setUi((prev) => ({ ...prev, viewMode: v })),
    setInfoEditing: (v) => setUi((prev) => ({ ...prev, infoEditing: v })),
    setTeamEditing: (v) => setUi((prev) => ({ ...prev, teamEditing: v })),
    setInfoOpen: (v) => setUi((prev) => ({ ...prev, infoOpen: v })),
    setTeamOpen: (v) => setUi((prev) => ({ ...prev, teamOpen: v })),
    updateCase,
    createCase,
    deleteCase,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
