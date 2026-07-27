# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build (also type-checks and runs `next build`'s static generation)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` + React Compiler / hooks-purity rules)
- `npx tsc --noEmit` — type-check only, no build artifacts
- `docker compose up -d` — start the local PostgreSQL container (`bid-scheduler-db`)
- `npm run db:generate` — generate a Drizzle migration from `src/db/schema.ts`; `npm run db:migrate` — apply
  pending migrations; `npm run db:seed` — reseed demo + admin accounts and sample case data; `npm run db:studio`
  — open Drizzle Studio
- There is no test suite/script in this project yet.

## Project docs (`docs/`)

Read these before making non-trivial changes — they're kept up to date on purpose, not left to rot:

- `docs/PROJECT_SPEC.md` — the original functional spec (scheduling rules, data model, UI spec) handed off by
  the user. If a scheduling rule or UI behavior seems arbitrary, check here first before "fixing" it.
- `docs/DECISIONS.md` (decisions) — why each architectural choice was made, including the Drizzle ORM choice and
  the localStorage→Postgres migration reasoning. Add an entry here whenever you make a non-obvious call.
- `docs/PROGRESS.md` (progress) — reverse-chronological log of completed work. Append to the top when you finish a
  batch of work; don't rewrite history.
- `docs/MEMORY.md` (context/memory) — what's currently blocked on external input (e.g. waiting on the user's Azure
  AD Client ID), open questions from the original spec, and the user's working-style preferences. Check this
  first if you're picking up this project cold.
- `docs/USAGE.md` (usage) — end-to-end setup and day-to-day command reference for a human operator.

## What this app is

A Next.js (App Router) port of a single-file HTML tool (`bid_scheduler.html` under the original spec) used by
a bid-preparation lead (業務投標手) at an architecture/engineering firm. Given a case's 招標公告時間 (tender
announcement date) and 投標截止 (submission deadline), it auto-generates the full checklist/timeline of internal
tasks (meetings, internal sign-offs, proposal production, document collection, evaluation-stage items) according
to the company's real bid-prep workflow, and tracks 9 key milestones. Users manage cases from a sidebar, and view
tasks either as a categorized checklist or as a draggable weekly calendar.

Case data lives in PostgreSQL (via Drizzle ORM, see below) — `AppContext` fetches `/api/cases` on mount and
debounces writes back through `PATCH`/`POST`/`DELETE` API routes. Login is real email/password credentials
auth (NextAuth/Auth.js), gated to 業務部 accounts, with per-case edit permission (only the 主投標手 who created
or claimed a case can edit/delete it — others get read-only). A separate `role` flag on `users` supports a
system-administrator account (bypasses the department gate) that gets its own admin shell — see "Admin role"
below — for member management and a cross-case project list, instead of the regular case-editing UI. Microsoft
Entra ID SSO and Outlook sync remain future work blocked on the user obtaining Azure AD credentials — see
`docs/MEMORY.md`.

### Admin role

`users.role` is `"member"` (default) or `"admin"`. Admin accounts:
- Bypass the `department === "業務部"` login gate (`src/auth.ts`'s `authorize()`).
- Get routed to `AdminShell` instead of the regular `AppShell` in `ClientApp.tsx`, based on
  `session.user.role` (propagated through the JWT/session callbacks in `src/auth.ts` and the module
  augmentation in `src/types/next-auth.d.ts`).
- See two sidebar sections (`AdminSidebar.tsx`): **系統成員** (`MembersPanel.tsx` — add/list/delete member
  accounts via `/api/users`, admin-only) and **專案管理** (`AdminProjectsPanel.tsx` — a read-only list of every
  case across all users, reusing the same `GET /api/cases` the regular app uses since it already returns all
  cases unfiltered).
- The admin shell intentionally does *not* reuse `AppContext`/`AppProvider` — admins don't edit individual
  cases, so there's no need to pull in the case-editing state machine for this role.

## Architecture

### Rendering: everything is client-only, on purpose

`src/app/page.tsx` is a client component that lazy-loads `src/components/ClientApp.tsx` via
`next/dynamic(..., { ssr: false })`. This predates the DB migration (case state used to be read synchronously
from `localStorage` via a lazy `useState` initializer, which genuinely can't run during SSR without a hydration
mismatch) and was kept as-is once the app moved to API-backed data, since `useSession()` (NextAuth) is also
client-only and there's nothing meaningful to server-render before a session is known anyway.

`AppContext` now loads case data with a real `useEffect` + `fetch("/api/cases")` on mount (see `loading` in its
return value) — this is a genuine network call, not a sync-from-external-store effect, so it's fine under the
`react-hooks/set-state-in-effect` lint rule (part of the React Compiler–aware config in `eslint-config-next`).
That rule only blocks effects that call `setState` purely to mirror something already available synchronously
(e.g. `localStorage`) — don't confuse the two when deciding whether a new effect needs a lazy-init workaround.

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

- `AppContext.tsx` — the single source of truth: `state: AppState` (all cases, fetched from `/api/cases` on
  mount) plus transient UI state (`viewMode`, panel open/edit flags) that intentionally resets when switching
  cases. `updateCase(id, fn)` is the standard way to mutate a case: it deep-clones the case, runs `fn` on the
  draft, updates local state immediately (optimistic), and debounces a `PATCH /api/cases/[id]` 400ms later per
  case id — use this rather than reaching into `state.cases` directly from components. `createCase`/`deleteCase`
  call `POST`/`DELETE` directly (no debounce). Errors from any of these surface via `useConfirm().customAlert`.
  `bid-scheduler-last-active-id` is still kept in `localStorage`, but purely as a UI convenience (which case tab
  to reopen) — it holds no case data itself anymore.
- `ConfirmContext.tsx` — replaces the original HTML tool's custom-modal confirm/alert (native `confirm()`/
  `alert()` were unreliable in that tool's sandboxed environment; this Promise-based modal is the direct port
  of that same workaround, kept for UI consistency, not because Next.js has the same sandbox issue). Use
  `useConfirm()` → `customConfirm(msg): Promise<boolean>` / `customAlert(msg): Promise<void>` instead of native
  dialogs when you need a blocking confirmation in this app.

### Component tree

`ClientApp` branches on `session.user.role` right after login: `"admin"` renders `AdminShell` (see "Admin role"
above); everything below this point is the regular `"member"` tree, wrapped in `AppProvider`.

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

### Database (`src/db/`, Drizzle ORM)

Postgres via **Drizzle ORM** (`drizzle-orm` + `drizzle-kit` + `pg` driver) — chosen over Prisma partway through
the DB migration; see `docs/DECISIONS.md` #3 and #12 for why.

- `src/db/schema.ts` — table definitions + `relations()` (enables `db.query.cases.findMany({ with: {...} })`).
  `users`/`accounts`/`sessions`/`verification_tokens` follow the standard Auth.js Drizzle-adapter shape,
  extended with `department` (業務部-only login gate), `passwordHash` (credentials login), and `role`
  (`"member" | "admin"` — see "Admin role" above). Domain tables (`cases`, `tasks`, `team_members`,
  `consultants`, `week_notes`) mirror the `src/lib/types.ts` shapes but as normalized rows with an explicit
  `sortIndex` (Postgres rows don't preserve array order the way the old JSON blob did — don't drop this field).
  `cases.deadline` is `text`, not `timestamp` — this app is timezone-naive throughout by design, and a
  `timestamp` column would risk silent off-by-timezone bugs; keep new date/time columns `text` unless there's a
  real reason to need timezone-aware storage.
- `src/db/index.ts` — the Drizzle client singleton (`pg.Pool` + `drizzle(pool, { schema })`, dev-mode global
  caching so hot-reload doesn't open a new pool every save).
- `drizzle.config.ts` — points `drizzle-kit` at `src/db/schema.ts` / `./drizzle` (migrations output) /
  `DATABASE_URL`. After editing `schema.ts`, run `npm run db:generate` then `npm run db:migrate` — never
  hand-edit files under `drizzle/`.
- `src/db/seed.ts` — generates its sample case by calling the real `generateTasks()` scheduling engine rather
  than hand-writing fake tasks (keep doing this so seed data never drifts from the actual scheduling rules), and
  seeds one demo member account plus one admin account (credentials logged to stdout when it runs).
- API routes under `src/app/api/` are the only server-side Drizzle callers — `src/lib/scheduler.ts` and anything
  it imports (like `constants.ts`) must stay free of React-component imports, since it's shared between client
  components and these server routes; icon components live in `src/lib/categoryIcons.tsx` specifically to keep
  that boundary clean (importing `@phosphor-icons/react` from `constants.ts` previously broke the production
  build with `TypeError: createContext is not a function` when collecting `/api/cases` page data).

### Styling

Design system is a fixed "公文/印章" (official-document/chop-stamp) paper theme, not a general light/dark theme.
Colors and fonts are defined once via Tailwind v4's `@theme` block in `src/app/globals.css` (e.g.
`--color-chop-red`, `--color-paper`), which auto-generates utilities like `bg-chop-red` / `text-ink-soft` —
components are styled with Tailwind utility classes directly in JSX, not bespoke CSS class names. The only
CSS that still lives in `globals.css` is what Tailwind genuinely can't express as a utility: `@keyframes`
definitions (referenced from JSX via arbitrary-value `animate-[name_duration_easing_iteration]` syntax) and the
org-tree's `::before` connector-line pseudo-elements. Don't reintroduce large blocks of hand-written component
CSS classes — if you need one-off styling, prefer Tailwind's arbitrary-value syntax first.

Icons are `@phosphor-icons/react` (SVG), not emoji — the original HTML tool used emoji for category/status
icons, but this was deliberately replaced per the `ui-ux-pro-max` design skill's guidance (functional icons
should be vector/SVG, not font-dependent emoji). The brand's paper/chop-stamp visual identity (colors, serif
title font, the circular "days remaining" stamp) is unrelated to this and is unchanged.

Fonts (Noto Serif TC / Noto Sans TC / IBM Plex Mono) are loaded via `next/font/google` in `src/app/layout.tsx`
and exposed as CSS variables (`--font-serif-tc`, `--font-sans-tc`, `--font-mono`) that the `@theme` block maps
to `font-serif` / `font-sans` / `font-mono` utilities — don't hardcode the Google Fonts family name strings.

## Workflow: large UI/redesign tasks

For any task that touches a large surface of the UI (a full component redesign, a new page, a styling-system
migration — not a small targeted fix), follow this standing process rather than ad-hoc iterating in the open:

1. **Implement with Tailwind utility classes** (see Styling above) — don't hand-roll new bespoke CSS classes,
   and don't use emoji for functional/structural icons; use `@phosphor-icons/react`.
2. **Verify visually in a loop before declaring anything done**: use the browser tool to screenshot every
   significant screen/state affected by the change, compare against intent, fix issues found, and re-screenshot
   — repeat until there's nothing left to fix. Don't skip this step because the code "looks right."
3. **Batch the whole task and report once.** Don't send incremental progress pings while working through a
   large task list — do the work, verify it, and give one consolidated summary at the end. This matches how
   the project owner prefers to work (see `docs/MEMORY.md`).

## 招標文件自動判讀 (`src/app/api/extract-tender`)

The original HTML tool's tender-document auto-read feature called `api.anthropic.com` directly from
client-side JS, which would've shipped an API key in the browser bundle — it was deliberately not ported
that way. It's since been rebuilt properly: `InfoPanel`'s edit mode has a multi-file upload (PDF or images)
that posts to `src/app/api/extract-tender/route.ts`, a server-side Route Handler that holds
`ANTHROPIC_API_KEY` and calls the Anthropic SDK directly (PDF pages / images as native `document`/`image`
content blocks, not client-side text extraction) to extract `contractAmount`/`siteArea`/`floorArea`/
`floorCount`/`tenderStart`/`deadline` as JSON, which the client then merges into the draft case (user still
reviews/edits before saving — nothing auto-saves). Requires `ANTHROPIC_API_KEY` in `.env` (get one from
console.anthropic.com); without it, the route returns a clear error and every other feature is unaffected.
