# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the dev server (Turbopack) at http://localhost:3000
- `npm run build` — production build (also type-checks and runs `next build`'s static generation)
- `npm run start` — serve the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` + React Compiler / hooks-purity rules)
- `npx tsc --noEmit` — type-check only, no build artifacts
- `docker compose up -d` — start the local PostgreSQL container (`bid-scheduler-db`)
- `npx prisma migrate dev` — apply schema changes; `npx prisma db seed` — reseed sample data
- There is no test suite/script in this project yet.

## Project docs (`docs/`)

Read these before making non-trivial changes — they're kept up to date on purpose, not left to rot:

- `docs/PROJECT_SPEC.md` — the original functional spec (scheduling rules, data model, UI spec) handed off by
  the user. If a scheduling rule or UI behavior seems arbitrary, check here first before "fixing" it.
- `docs/DECISIONS.md` (decisions) — why each architectural choice was made, including Prisma-7-specific gotchas and
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

Case data currently still lives in the browser's `localStorage` (key `bid-cases`), mirroring the original
artifact's `window.storage` persistence — the frontend has **not yet** been wired to the database (see below).
A PostgreSQL database + full Prisma schema already exists (`prisma/schema.prisma`, migrated and seeded) in
preparation for multi-user access with department-gated login and per-case edit permissions (only the 主投標手
can edit their own case; everyone else in 業務部 gets read-only). Wiring the frontend to real API routes and
turning on Microsoft Entra ID login are the next two milestones — see `docs/MEMORY.md` for exactly what's blocking
each one before you start on them.

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

### Database (`prisma/`, `src/lib/prisma.ts`)

Prisma **7** — noticeably different from most Prisma tutorials/training data (v7 made driver adapters
mandatory, moved connection config to `prisma.config.ts`, and changed the default generator/output). Before
touching anything Prisma-related, skim `.claude/skills/prisma-*` (installed locally, mirrors the official
`prisma/skills` repo) rather than assuming v5/v6 conventions:

- Generator is `prisma-client` (not `prisma-client-js`), output to `src/generated/prisma` (gitignored, run
  `npx prisma generate` to regenerate — don't hand-edit anything under there).
- `PrismaClient` **requires** a driver adapter — see `src/lib/prisma.ts` for the singleton (`@prisma/adapter-pg`
  wired to `DATABASE_URL`). Never instantiate `new PrismaClient()` without the adapter.
- Connection URL lives in `prisma.config.ts` (loaded via `dotenv/config`), not inline in `schema.prisma`.
- Schema models: `users`/`accounts`/`sessions`/`verification_tokens` follow the standard NextAuth Prisma-adapter
  shape (extended with `users.department` for the 業務部-only login gate) — keep this shape intact so the
  NextAuth Adapter can be dropped in later without a schema rewrite. Domain tables (`cases`, `tasks`,
  `team_members`, `consultants`, `week_notes`) mirror the `src/lib/types.ts` shapes but as normalized rows with
  an explicit `sortIndex` (Postgres rows don't preserve array order the way the old JSON blob did — don't drop
  this field when writing the eventual CRUD API).
- `prisma/seed.ts` generates its sample case by calling the real `generateTasks()` scheduling engine rather than
  hand-writing fake tasks — keep doing this so seed data never drifts from the actual scheduling rules.

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

## Known gap vs. the original spec

The original HTML tool's "招標文件自動判讀" (upload a tender PDF, extract text with pdf.js, send it to the
Claude API to auto-fill contract amount / site area / floor area / deadline) was intentionally not ported. That
flow called `api.anthropic.com` directly from client-side JS, which would mean shipping an API key in the
browser bundle — not something to reintroduce without a real backend/proxy to hold the key server-side.
