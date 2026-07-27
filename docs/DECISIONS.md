# DECISIONS.md — Architecture & Design Decision Log

> Records *why*, not *what* (that's `PROGRESS.md`). Each entry: context / decision / consequence.

## 1. Ported the single HTML file to a Next.js project

**Context**: `bid_scheduler.html` was a single-file frontend-only tool (HTML+CSS+vanilla JS), data stored in
the browser's `window.storage`.
**Decision**: Rebuilt as Next.js (App Router) + TypeScript + React, split into components, matching the user's
request for "standard Claude architecture."
**Consequence**: Logic (scheduling engine, date helpers, constants) moved to `src/lib/`; UI split into
independent components under `src/components/`; state management started with React Context + localStorage
(decision 2), later migrated toward Postgres (decision 3).

## 2. State management: React Context + localStorage first, not straight to a database

**Context**: No backend/database existed at first, and the original tool was single-machine by design.
**Decision**: `AppContext` uses `useState` + `localStorage` (key kept as `bid-cases`), debounced 400ms writes,
matching the original `window.storage`'s `queueSave` behavior.
**Technical detail**: `AppProvider`'s whole subtree is wrapped in `next/dynamic(..., {ssr:false})`, and state is
initialized via `useState(() => loadState())` lazy initializer — **no** `useEffect` for initial load. The
newer `eslint-config-next` (React-Compiler-aware hooks lint) blocks that pattern:
- `react-hooks/purity`: don't call impure functions like `Date.now()` directly in a component/hook body — wrap
  it in a plain helper in `src/lib/` instead (e.g. `caseDaysLeft`).
- `react-hooks/set-state-in-effect`: don't call setState in an effect purely to sync from an external store on
  mount. The correct fix is lazy initializer + `ssr:false` (avoids SSR reading empty localStorage and causing a
  hydration mismatch).
**Consequence**: This "lazy init + ssr:false" pattern is now the repo convention for any future client-only
state — don't go back to an "onMount setState" effect.

## 3. Migrated from localStorage to PostgreSQL + Prisma (multi-user)

**Context**: The user wants department-gated login ("only 業務部 can sign in") plus per-case edit permission
(only the bid lead can edit their own case, everyone else read-only). localStorage is per-browser and can't
support multi-user sharing or permission checks.
**Decision**: Moved to PostgreSQL (local dev via Docker Compose). Chose **Prisma** as the ORM (mature ecosystem,
official NextAuth adapter, type safety).
**Version detail**: Installed **Prisma 7** (much newer than training data, behaves differently from Prisma
5/6 — confirmed against Prisma's own official upgrade skill before writing anything):
- Default generator is `prisma-client` (not the old `prisma-client-js`); output directory must be specified
  explicitly (set to `src/generated/prisma`, gitignored).
- Connection config moved to `prisma.config.ts` (not a hardcoded `url = env(...)` in `schema.prisma`).
- **Driver adapters are now required**: the `PrismaClient` constructor takes a `@prisma/adapter-pg` adapter
  instance — no more bare `new PrismaClient()`. Singleton lives in `src/lib/prisma.ts`.
**Consequence**: If `npm install` prompts for `npm approve-scripts`, that's npm's new script allowlist — approve
`@prisma/engines`, `prisma`, `sharp`, and `unrs-resolver` for things to work correctly.

## 4. Schema: `cases` keeps both `bidLeadName` and `bidLeadUserId`

**Context**: Permission checks (only the bid lead can edit) need a stable logged-in user ID, but the scheduling
engine (`generateTasks`) already uses the bid lead's *name* as the default task owner string — that existing
logic shouldn't be touched.
**Decision**: `Case` keeps both fields:
- `bidLeadName` (free text; the scheduling engine's default-owner source)
- `bidLeadUserId` (nullable, points at `users.id`; permission checks use this)
**Consequence**: Before anyone has actually logged in with a Microsoft account, `bidLeadUserId` can stay null
(case created with just a name); once login is wired up, the UI can let a user "claim" a case as their own.

## 5. Auth tables follow the standard NextAuth Prisma-adapter shape

**Context**: The user confirmed everyone at the company has their own Microsoft account and wants "each person
signs in with their own Microsoft account."
**Decision**: `users`/`accounts`/`sessions`/`verification_tokens` follow NextAuth.js's official Prisma Adapter
field naming exactly, so the Microsoft Entra ID provider can be dropped in later without a schema rewrite.
`users` gets an extra `department` field, to be populated from Microsoft Graph `/me`'s department field, used
to restrict login to 業務部 only.
**Not yet done**: The actual OAuth wiring (NextAuth config, Microsoft Entra ID App Registration) isn't built
yet — it needs the user to register an app in Azure Portal to get a Client ID, which isn't something I can do
on their behalf (see `MEMORY.md`).

## 6. Outlook sync: columns reserved now, logic once Azure AD credentials land

**Context**: The user wants task reminders to sync to Outlook, and meetings to be optionally created in
Outlook's calendar.
**Decision**: `tasks` gets two columns now: `syncToOutlook` (boolean — did the user opt this task in) and
`outlookEventId` (the Microsoft Graph event ID once synced, for later updates/deletes).
**Consequence**: Columns are in place, but the actual Microsoft Graph Calendar API calls can't be written until
NextAuth + Entra ID login (decision 5) exists and can produce a Graph access token.

## 7. Team panel restructure: 建築師團隊 / 建國工程團隊 + drag classification + org tree

**Context**: The user disliked the original edit mode's long vertical list layout, and consultants actually
belong to one of two internal teams ("Architect Team" / "Jianguo Engineering Team") — they wanted to drag
consultants directly into either group.
**Decision**:
- `Consultant` gains `id` (didn't exist before; `role` strings can repeat and drag targets need a stable key)
  and `teamGroup` (`'architect' | 'jianguo' | null`).
- Edit mode becomes two side-by-side drop-zone boxes (`TeamBox`): architect/MEP name lists sit in their
  respective box; consultants can be dragged in from an "unclassified" pool, or dragged back out / unassigned
  via a × button.
- View mode becomes a nested org-chart tree (root "Bid Prep Team" → two branch nodes → member cards under
  each), replacing the old flat card grid.
- Drag-and-drop uses the native HTML5 DnD API (`draggable` + `onDragStart`/`onDragOver`/`onDrop`) — the same
  pattern as the calendar's drag-to-reschedule, kept consistent on purpose rather than pulling in a DnD library.
**Verification note**: the automated browser tool's `left_click_drag` can't trigger native HTML5 drag events
(a known automation limitation, not a code bug) — verified the `onDrop` logic directly instead by dispatching
real `DragEvent`s via JS.

## 8. Progress-bar milestone markers: flag emoji → animated dots + time-pressure gradient

**Context**: The user disliked the 🚩 flag icons for milestones and wanted markers positioned proportionally
along the timeline, color-coded by urgency, with the progress bar itself expressing time pressure via a
gradient.
**Decision**:
- Marker status has four states: `done` (grey, static) / `overdue` (red, strong pinging animation) / `soon`
  (amber, gentler pinging, threshold **within 5 days**) / `normal` (gold, static).
- The track background becomes `linear-gradient(90deg, green, amber 55%, red 100%)` representing "time
  pressure"; the completion fill overlays a semi-transparent dark layer (`var(--ink)` at `opacity:0.6`) — so
  completed portions dim while remaining portions stay in the vivid warning gradient.
- Position calculation (`posPct`, proportional to the workStart~deadline range) is unchanged — only the visuals
  changed.

## 9. Calendar day-cell event cap

**Context**: A busy day stretched its cell, distorting the whole calendar grid.
**Decision**: Each day cell shows at most 3 events by default; beyond that, a "+N expand" button reveals the
rest (only that row's height grows, not the rest of the calendar). `.cal-day`'s `max-height` is kept as a
safety net.

## 10. UI moved fully to Tailwind CSS + Phosphor icons (replacing bespoke CSS classes and emoji)

**Context**: The user asked for Tailwind CSS and a full component redesign, and installed the `ui-ux-pro-max`
skill (a third-party Claude Code skill — a UI/UX design-guideline database).
**Decision**:
- Colors/fonts moved to Tailwind v4's `@theme` block (e.g. `--color-chop-red`), which auto-generates utilities
  like `bg-chop-red` / `text-ink-soft`, replacing the long list of bespoke classes (`.task-row`, `.cal-day`, …).
- Animations (milestone pinging, overdue calendar pulse, etc.) keep a small number of `@keyframes` in
  `globals.css`, referenced from JSX via Tailwind's arbitrary-value syntax (e.g.
  `animate-[msPing_1.1s_ease-out_infinite]`) — Tailwind doesn't auto-generate custom keyframes, so this is the
  one place bespoke CSS remains necessary (along with the org-tree's `::before` connector lines).
- Per the `ui-ux-pro-max` skill's guidance, functional emoji (📋🗓️🏢📄📑🎤📌 etc., previously used as
  category/status icons) were replaced with `@phosphor-icons/react` SVG icons. The brand's paper/chop-stamp
  visual identity (colors, fonts, the circular stamp motif) is unaffected — only icon *rendering technology*
  changed.
**Consequence**: New UI work should default to Tailwind utility classes + Phosphor icons; avoid adding more
bespoke CSS classes or emoji-as-icon going forward (brand colors, the stamp motif, and fonts stay per §7 of
`PROJECT_SPEC.md`).

## 11. Database seed data reuses the scheduling engine

**Context**: Need demo data for local dev and demos.
**Decision**: `src/db/seed.ts` imports `generateTasks` from `src/lib/scheduler.ts` directly and generates the
seed case's tasks with the real scheduling rules, rather than hand-writing fake tasks — keeps seed data from
drifting out of sync with the actual scheduling logic.

## 12. Switched ORM from Prisma to Drizzle (mid-migration)

**Context**: The DB schema and NextAuth adapter wiring were already built on Prisma 7 (decisions 3, 5) when the
user explicitly asked to switch to Drizzle instead ("dazzle 幫我改用 不要用 prisma") — no specific reason given,
treated as a direct preference rather than something to push back on.
**Decision**: Full clean removal and rebuild rather than a partial patch: deleted `prisma/`, `prisma.config.ts`,
`src/generated/prisma`, `src/lib/prisma.ts`; added `src/db/schema.ts` (Drizzle table defs + `relations()`),
`src/db/index.ts` (client singleton), `drizzle.config.ts`, and switched the NextAuth adapter to
`@auth/drizzle-adapter`.
**Gotcha found along the way**: NextAuth v5's `next-auth/jwt` re-exports the `JWT` interface from
`@auth/core/jwt` via `export *`, which silently breaks `declare module "next-auth/jwt"` augmentation (TS error
"Type '{}' is not assignable to type 'string'" on custom fields). Fix: augment `"@auth/core/jwt"` directly (see
`src/types/next-auth.d.ts`) — confirmed via `grep -n "interface JWT"` in `node_modules` that this is the
interface's actual home.
**Consequence**: All future schema/migration work uses Drizzle conventions (`npm run db:generate` /
`db:migrate`, see `CLAUDE.md`'s Database section) — don't reintroduce Prisma.

## 13. Wired AppContext to the real API instead of localStorage

**Context**: Case data was still round-tripping through `localStorage` even after the Postgres schema and CRUD
API routes existed — the user flagged this explicitly ("App 目前資料還是存在瀏覽器 localStorage...幫我串資料庫").
**Decision**: `AppContext` now fetches `/api/cases` in a real `useEffect` on mount (exposed as a `loading` flag)
and debounces `PATCH` writes per-case-id (400ms) instead of debouncing a single `localStorage.setItem`. This is
a genuine network call, not a sync-from-external-store effect, so it doesn't trigger the
`react-hooks/set-state-in-effect` lint rule that blocked a naive `useEffect` in the localStorage era (see
decision 2) — see `CLAUDE.md`'s Rendering section for how this distinction is drawn.
**Consequence**: `localStorage` now only holds `bid-scheduler-last-active-id` (which case tab to reopen — a UI
convenience), no case data.

## 14. System-administrator role added (`users.role`)

**Context**: The user asked for a system-admin account that can manage member accounts (add/list/delete) and
see a list of every project across all users, reachable from two new Sidebar entries (系統成員/專案管理) rather
than being folded into the existing per-case bid-lead UI.
**Decision**: Added `users.role` (`pgEnum`, `"member" | "admin"`, default `"member"`) rather than reusing
`department` for this — department is about which business unit someone belongs to (used for the 業務部 login
gate), role is about system-level permissions, and conflating the two would make the login gate logic harder to
reason about. Admin accounts bypass the department gate entirely (`src/auth.ts`).
**UI decision**: Built a completely separate `AdminShell` (own Header + Sidebar + content), rather than adding
admin-only branches inside the existing case-focused `AppShell`/`Sidebar`/`MainView`. Reasoning: the admin role
has a deliberately minimal, unrelated feature set (member management + a read-only project list) — it doesn't
touch `AppContext`'s case-editing state machine at all, so forcing it through the same component tree would add
conditional branches to components that otherwise have nothing to do with user/role management.
**Scope decision**: `AdminProjectsPanel` reuses the existing `GET /api/cases` (which already returns every case
unfiltered, regardless of caller) rather than adding a new admin-specific endpoint — no filtering-by-owner logic
exists on that route today, so there was nothing extra to build. Member management is intentionally add+list+
delete only (no edit-in-place) per the user's "不用其他東西" (nothing else needed) — don't add an edit flow
unless asked.
