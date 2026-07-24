# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build (also type-checks and runs `next build`'s static generation)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` + React Compiler / hooks-purity rules)
- `npx tsc --noEmit` — type-check only, no build artifacts
- There is no test suite/script in this project yet.

## What this app is

A Next.js (App Router) port of a single-file HTML tool (`bid_scheduler.html` under the original spec) used by
a bid-preparation lead (業務投標手) at an architecture/engineering firm. Given a case's 招標公告時間 (tender
announcement date) and 投標截止 (submission deadline), it auto-generates the full checklist/timeline of internal
tasks (meetings, internal sign-offs, proposal production, document collection, evaluation-stage items) according
to the company's real bid-prep workflow, and tracks 9 key milestones. Users manage cases from a sidebar, and view
tasks either as a categorized checklist or as a draggable weekly calendar.

There is no backend — all case data lives in the browser's `localStorage` (key `bid-cases`), mirroring the
original artifact's `window.storage` persistence. The whole app is intentionally client-only (see Architecture).

## Architecture

### Rendering: everything is client-only, on purpose

`src/app/page.tsx` is a client component that lazy-loads `src/components/ClientApp.tsx` via
`next/dynamic(..., { ssr: false })`. This is deliberate, not an oversight: case state is read synchronously from
`localStorage` via a `useState(() => loadState())` lazy initializer in `AppContext` (no loading effect, no
loading-flag gate). Reading `window.localStorage` during SSR would return empty data and diverge from the
client's real data, causing a hydration mismatch — disabling SSR for this subtree sidesteps that entirely.
Keep this pattern if you touch initial-load logic; don't reintroduce an `useEffect` that just calls `setState`
on mount purely to sync from an external store — the lint rule `react-hooks/set-state-in-effect` (part of the
React Compiler–aware config in `eslint-config-next`) will flag it, and the intended fix is exactly this
lazy-init + `ssr:false` combo, not a bigger loading-state machine.

The lint config also enforces `react-hooks/purity`: don't call `Date.now()` (or similar impure calls) directly
in a component/hook body — pull it through a plain helper function instead (see `src/lib/derived.ts`'s
`caseDaysLeft`). Plain utility functions (non-component, non-hook) aren't subject to this rule, which is why
date math lives in `src/lib/date.ts` / `src/lib/derived.ts` rather than inline in components.

### Data model & scheduling engine (`src/lib/`)

- `types.ts` — `Case`, `Task`, `Team`, `Consultant`, `AppState` shapes. A `Case` holds its own `tasks: Task[]`;
  `AppState.cases` is a `Record<caseId, Case>`.
- `scheduler.ts` — `generateTasks(c: Case): Task[]` is the rule engine: given `c.start` (tender announcement,
  the anchor for most rules) and `c.deadline` (submission deadline, the other anchor), it produces every task
  with computed due dates (recurring weekly meetings, pre-bid meetings whose count depends on
  `contractAmount` ≥ 80億, proposal production milestones, etc.). `c.workStart` only affects displayed date
  ranges, never the rule computations. Also home to `normalizeTeam`/`normalizeCase` (back-fills the 13 default
  consultant roles and legacy field defaults onto whatever `Case`/`Team` data already exists) and
  `getOwnerOptions` (dedup'd list of assignable owners for a case, used by the list view's owner `<select>`).
- `date.ts` — small date helpers, notably `snapToBizDay` (Sat→Fri, Sun→Fri-2) which most rules run their
  computed date through, and `uid()` for id generation.
- `constants.ts` — the 6 fixed task categories (A–F) with their letter/color/icon, the 13 default consultant
  roles, and `MILESTONE_ORDER` (the 9 tracked milestones, keyed by the `Task.milestone` string).
- `derived.ts` — small derived-value helpers (`caseDaysLeft`, `caseProgress`) kept outside components for the
  purity-rule reason above.

If you change a scheduling rule, it belongs in `generateTasks`; nothing else recomputes task dates. Regenerating
a case's schedule (the "🔄 重新依目前設定產生排程" button in `InfoPanel`) fully replaces `case.tasks`, discarding
any manual edits/completions — that's existing, intentional behavior, not a bug.

### State management (`src/context/`)

- `AppContext.tsx` — the single source of truth: `state: AppState` (all cases, persisted) plus transient UI
  state (`viewMode`, panel open/edit flags) that intentionally resets when switching cases. `updateCase(id, fn)`
  is the standard way to mutate a case: it deep-clones the case, runs `fn` on the draft, and replaces it — use
  this rather than reaching into `state.cases` directly from components. Saves to `localStorage` are debounced
  400ms after `state` changes.
- `ConfirmContext.tsx` — replaces the original HTML tool's custom-modal confirm/alert (native `confirm()`/
  `alert()` were unreliable in that tool's sandboxed environment; this Promise-based modal is the direct port
  of that same workaround, kept for UI consistency, not because Next.js has the same sandbox issue). Use
  `useConfirm()` → `customConfirm(msg): Promise<boolean>` / `customAlert(msg): Promise<void>` instead of native
  dialogs when you need a blocking confirmation in this app.

### Component tree

`ClientApp` → `Sidebar` (case tabs + "＋新增案件") and, in `.main`, either `NewCaseForm` (no active case) or
`CaseView` (active case). `CaseView` composes `CaseHeader` (title + days-left "chop stamp"), `AlertBanner`
(overdue/due-soon tasks, click-to-jump), `ProgressPanel` (progress bar + floating milestone flag markers),
`InfoPanel` and `TeamPanel` (each has independent view/edit-mode and open/closed state, deliberately *not* reset
by re-renders — only by switching cases, per `setActiveId`), and the `ListView`/`CalendarView` toggle.
`ProjectManagerModal` (cross-case table: open/delete any case) is triggered from the floating `pm-fab` button
independent of the sidebar.

`CalendarView` implements drag-and-drop task rescheduling with the HTML5 DnD API directly (`draggable`,
`onDragStart`/`onDrop`) rather than a library — keep it that way unless multi-day drag or touch support is
actually needed.

### Styling

Design system is a fixed "公文/印章" (official-document/chop-stamp) paper theme, not a general light/dark theme
— CSS custom properties (`--paper`, `--chop-red`, `--ink`, etc.) are defined once in `src/app/globals.css`, and
components use plain class names (`.task-row`, `.cal-day`, `.stamp`, ...) rather than Tailwind utilities, ported
near-verbatim from the original HTML file's `<style>` block. Fonts (Noto Serif TC / Noto Sans TC / IBM Plex
Mono) are loaded via `next/font/google` in `src/app/layout.tsx` and exposed as CSS variables
(`--font-serif-tc`, `--font-sans-tc`, `--font-mono`) that `globals.css` references — don't hardcode the Google
Fonts family name strings in new CSS, use the variables.

## Known gap vs. the original spec

The original HTML tool's "招標文件自動判讀" (upload a tender PDF, extract text with pdf.js, send it to the
Claude API to auto-fill contract amount / site area / floor area / deadline) was intentionally not ported. That
flow called `api.anthropic.com` directly from client-side JS, which would mean shipping an API key in the
browser bundle — not something to reintroduce without a real backend/proxy to hold the key server-side.
