"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { AppState, Case, ViewMode } from "@/lib/types";
import { canEditCase, resolveLinkedTaskDates } from "@/lib/derived";
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
  // Always true now — anyone may edit any case (see isCaseOwner for the actual ownership check
  // used to gate the non-owner confirmation warning). Kept as a separate flag from isCaseOwner
  // so existing `disabled={!canEditActive}` call sites across components didn't need touching.
  canEditActive: boolean;
  isCaseOwner: boolean;
  setActiveId: (id: string | null) => void;
  setViewMode: (v: ViewMode) => void;
  setInfoEditing: (v: boolean) => void;
  setTeamEditing: (v: boolean) => void;
  setInfoOpen: (v: boolean) => void;
  setTeamOpen: (v: boolean) => void;
  updateCase: (id: string, updater: (c: Case) => void) => void;
  createCase: (data: { name: string; workStart: string; deadline: string }) => void;
  // Set to the new case's id right after createCase succeeds — CaseView compares this against
  // its own caseId (once, via the "adjust state during render" pattern) to decide whether to
  // auto-show the 新手教學 onboarding tutorial. See OnboardingTutorial.tsx.
  justCreatedId: string | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { customAlert, customConfirm } = useConfirm();
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
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  // Case ids the current user has already confirmed editing despite not being the 主投標手 —
  // resets on page reload, so the warning reappears each new session, not each keystroke.
  const nonOwnerConfirmed = useRef<Set<string>>(new Set());

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

  // Actually sends one case's pending save — factored out of the setTimeout body so the
  // beforeunload flush below can call the exact same logic synchronously-ish (via fetch's
  // `keepalive`) instead of waiting for the normal 400ms debounce, which would otherwise just get
  // dropped when the tab closes before it fires.
  const sendSave = useCallback(
    async (id: string, payload: Case, opts?: { keepalive?: boolean }) => {
      try {
        const res = await fetch(`/api/cases/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: opts?.keepalive,
        });
        const resBody = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 409) {
            // Someone else saved this case in between — our local copy is stale and would have
            // clobbered their newer data. Re-fetch this one case fresh rather than retrying with
            // the same stale payload (which would just 409 again).
            await customAlert(resBody.error || "這個案件已被其他人更新過，將重新載入最新內容。");
            const fresh = await fetch(`/api/cases/${id}`).then((r) => (r.ok ? r.json() : null));
            if (fresh?.cases?.[id]) {
              setState((prev) => ({ ...prev, cases: { ...prev.cases, [id]: fresh.cases[id] } }));
            }
            return;
          }
          throw new Error(resBody.error || `PATCH failed: ${res.status}`);
        }
        if (resBody.updatedAt) {
          setState((prev) => {
            const current = prev.cases[id];
            if (!current) return prev;
            return { ...prev, cases: { ...prev.cases, [id]: { ...current, updatedAt: resBody.updatedAt } } };
          });
        }
      } catch (err) {
        console.error(err);
        await customAlert(err instanceof Error ? err.message : "儲存失敗，請稍後再試。");
      }
    },
    [customAlert]
  );

  const persistCase = useCallback(
    (id: string, caseData: Case) => {
      pendingSaves.current[id] = caseData;
      if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
      saveTimers.current[id] = setTimeout(() => {
        const payload = pendingSaves.current[id];
        delete pendingSaves.current[id];
        delete saveTimers.current[id];
        sendSave(id, payload);
      }, 400);
    },
    [sendSave]
  );

  // Without this, editing a field and closing/navigating away within the 400ms debounce window
  // silently drops the edit — nothing ever sends it. `keepalive` lets the request outlive page
  // unload (unlike a plain fetch, which the browser can cancel mid-flight on navigation).
  useEffect(() => {
    const flushPendingSaves = () => {
      Object.keys(pendingSaves.current).forEach((id) => {
        if (saveTimers.current[id]) {
          clearTimeout(saveTimers.current[id]);
          delete saveTimers.current[id];
        }
        const payload = pendingSaves.current[id];
        delete pendingSaves.current[id];
        sendSave(id, payload, { keepalive: true });
      });
    };
    window.addEventListener("beforeunload", flushPendingSaves);
    window.addEventListener("pagehide", flushPendingSaves);
    return () => {
      window.removeEventListener("beforeunload", flushPendingSaves);
      window.removeEventListener("pagehide", flushPendingSaves);
    };
  }, [sendSave]);

  const applyCaseUpdate = useCallback(
    (id: string, updater: (c: Case) => void) => {
      setState((prev) => {
        const existing = prev.cases[id];
        if (!existing) return prev;
        const next: Case = JSON.parse(JSON.stringify(existing));
        updater(next);
        next.tasks = resolveLinkedTaskDates(next.tasks);
        persistCase(id, next);
        return { ...prev, cases: { ...prev.cases, [id]: next } };
      });
    },
    [persistCase]
  );

  // Anyone can edit any case now, but the first time a non-owner (someone other than the
  // case's 主投標手) touches a case in this session, gate the change behind a blocking
  // confirmation — subsequent edits to that same case go straight through.
  const updateCase = useCallback(
    (id: string, updater: (c: Case) => void) => {
      const existing = state.cases[id];
      if (!existing) return;
      if (canEditCase(existing, currentUserId) || nonOwnerConfirmed.current.has(id)) {
        applyCaseUpdate(id, updater);
        return;
      }
      customConfirm(
        `你並非本案「${existing.name}」的主投標手（目前為 ${existing.bidLead || "尚未指定"}），確定要修改這個案件的內容嗎？`
      ).then((ok) => {
        if (ok) {
          nonOwnerConfirmed.current.add(id);
          applyCaseUpdate(id, updater);
        }
      });
    },
    [state.cases, currentUserId, customConfirm, applyCaseUpdate]
  );

  const createCase = useCallback(
    (data: { name: string; workStart: string; deadline: string }) => {
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
          setJustCreatedId(id);
        } catch (err) {
          console.error(err);
          await customAlert("建立案件失敗，請稍後再試。");
        }
      })();
    },
    [setActiveId, customAlert]
  );

  const activeCase = activeId ? state.cases[activeId] ?? null : null;
  const isCaseOwner = activeCase ? canEditCase(activeCase, currentUserId) : true;

  const value: AppContextValue = {
    state,
    activeId,
    activeCase,
    ui,
    loading,
    currentUserId,
    canEditActive: true,
    isCaseOwner,
    setActiveId,
    setViewMode: (v) => setUi((prev) => ({ ...prev, viewMode: v })),
    setInfoEditing: (v) => setUi((prev) => ({ ...prev, infoEditing: v })),
    setTeamEditing: (v) => setUi((prev) => ({ ...prev, teamEditing: v })),
    setInfoOpen: (v) => setUi((prev) => ({ ...prev, infoOpen: v })),
    setTeamOpen: (v) => setUi((prev) => ({ ...prev, teamOpen: v })),
    updateCase,
    createCase,
    justCreatedId,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
