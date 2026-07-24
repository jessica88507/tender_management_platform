"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, Case, ViewMode } from "@/lib/types";
import { generateTasks, normalizeCase, normalizeTeam } from "@/lib/scheduler";
import { uid } from "@/lib/date";

const STORAGE_KEY = "bid-cases";

function emptyState(): AppState {
  return { cases: {}, lastActiveId: null };
}

function loadState(): AppState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.cases) return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return emptyState();
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
  setActiveId: (id: string | null) => void;
  setViewMode: (v: ViewMode) => void;
  setInfoEditing: (v: boolean) => void;
  setTeamEditing: (v: boolean) => void;
  setInfoOpen: (v: boolean) => void;
  setTeamOpen: (v: boolean) => void;
  updateCase: (id: string, updater: (c: Case) => void) => void;
  createCase: (data: {
    name: string;
    start: string;
    deadline: string;
  }) => string;
  deleteCase: (id: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activeId, setActiveIdRaw] = useState<string | null>(() => {
    const s = loadState();
    return s.lastActiveId && s.cases[s.lastActiveId] ? s.lastActiveId : Object.keys(s.cases)[0] || null;
  });
  const [ui, setUi] = useState<UIState>({
    viewMode: "cal",
    infoEditing: false,
    teamEditing: false,
    infoOpen: false,
    teamOpen: false,
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstSave = useRef(true);

  useEffect(() => {
    if (isFirstSave.current) {
      isFirstSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // storage full or unavailable
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const setActiveId = useCallback((id: string | null) => {
    setActiveIdRaw(id);
    setUi({ viewMode: "cal", infoEditing: false, teamEditing: false, infoOpen: false, teamOpen: false });
    setState((prev) => ({ ...prev, lastActiveId: id }));
  }, []);

  const updateCase = useCallback((id: string, updater: (c: Case) => void) => {
    setState((prev) => {
      const existing = prev.cases[id];
      if (!existing) return prev;
      const next: Case = JSON.parse(JSON.stringify(existing));
      updater(next);
      return { ...prev, cases: { ...prev.cases, [id]: next } };
    });
  }, []);

  const createCase = useCallback((data: { name: string; start: string; deadline: string }) => {
    const id = uid();
    const cData: Case = {
      name: data.name,
      start: data.start,
      deadline: data.deadline,
      workStart: data.start,
      bidLead: "",
      meetingWeekday: 2,
      contractAmount: 0,
      siteArea: 0,
      floorArea: 0,
      floorCount: "",
      weekNotes: {},
      team: normalizeTeam(undefined),
      tasks: [],
    };
    normalizeCase(cData);
    cData.tasks = generateTasks(cData);
    setState((prev) => ({
      ...prev,
      cases: { ...prev.cases, [id]: cData },
      lastActiveId: id,
    }));
    setActiveIdRaw(id);
    setUi({ viewMode: "cal", infoEditing: true, teamEditing: true, infoOpen: true, teamOpen: true });
    return id;
  }, []);

  const deleteCase = useCallback((id: string) => {
    setState((prev) => {
      const nextCases = { ...prev.cases };
      delete nextCases[id];
      const remaining = Object.keys(nextCases);
      const nextActive = remaining[0] || null;
      return { ...prev, cases: nextCases, lastActiveId: nextActive };
    });
    setActiveIdRaw((prev) => (prev === id ? null : prev));
  }, []);

  const activeCase = activeId ? state.cases[activeId] ?? null : null;

  const value: AppContextValue = {
    state,
    activeId,
    activeCase,
    ui,
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
