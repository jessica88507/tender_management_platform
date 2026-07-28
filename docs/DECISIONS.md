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

## 15. 招標公告／投標截止 are calendar-only time points, never alert/overdue-flagged (finished properly)

**Context**: `derived.ts` already excluded milestone keys `collect`/`deadline` from the *overdue* alert tier
(`NO_OVERDUE_ALERT_KEYS`) and from the completion-percentage denominator (`isNonCheckableTask`/
`NON_CHECKABLE_MILESTONES`), per a prior pass. But the user reported (again — "已經改了很多次了") that these two
still visibly nag: `ProgressPanel`'s milestone card flashed permanently red once the date passed (its own
`status` calc never checked `isNonCheckableTask`, just `t.done`, which these two can never be), `CalendarView`
pulsed the day cell "待處理" and flashed the event card `milestoneOverdue` for them, and `urgentTasks()` still
surfaced them in the 警示提醒 bell whenever they were due "soon" or today (only *overdue* was excluded, not
upcoming).
**Decision**: Made `isNonCheckableTask` the single source of truth for "this is a fixed calendar marker, not a
task" across all four surfaces: `urgentTasks()` now excludes them outright (not just from the overdue tier);
`ProgressPanel`'s status calc special-cases them to `"done"` (past) / `"normal"` (future) — never
`"overdue"`/`"soon"`; `CalendarView`'s `alertDates` and `milestoneOverdue` both skip them. The milestone-marker
*styling itself* (star icon, highlight background, position on the progress bar) is untouched — only the
overdue/soon/alert treatment is suppressed, since the user explicitly said the marker behavior itself was
correct and shouldn't change.
**Consequence**: `NO_OVERDUE_ALERT_KEYS` in `derived.ts` now only needs `eval_presentation_day` (a different,
checkable milestone that just shouldn't sit in the overdue tier forever) — `collect`/`deadline` are handled
entirely through `isNonCheckableTask` instead. If a future milestone needs this same "calendar point, not a
task" treatment, add its key to `NON_CHECKABLE_MILESTONES`, not to four separate places.

## 16. Consultant roster: default (non-custom) rows are now editable/deletable too

**Context**: `TeamPanel`'s "專業顧問明細" table gated the role-name `<input>` and the delete button behind
`row.custom` — so the 13 seeded default consultant roles (`CONSULTANT_DEFAULTS`, `custom: false`) could only
have their company/contact filled in, never renamed or removed. The user's request ("新增後不能編輯，請幫我新增
編輯功能，可以編輯跟刪除") was about the roster in general, not specifically the user-added rows (which already
supported this).
**Decision**: Removed the `row.custom` gate on both the role-name input and the delete button — every row is
now editable and deletable, regardless of origin.
**Follow-on problem found while testing**: `normalizeTeam` (called on every case open, not just creation)
backfills any `CONSULTANT_DEFAULTS` role missing from `team.consultants` by exact role-string match. Once
deletion was unlocked, this silently resurrected any deleted default the next time the case was opened —
deletion looked broken. Fixed by only running that backfill when `team.consultants.length === 0` (brand-new
case, or a case with every consultant removed) instead of per-missing-role — a new case still gets all 13
defaults seeded once, but a deliberate deletion now actually sticks.

## 17. Removed 連結任務 (linked-task) creation UI from ListView's task rows

**Context**: The user asked to remove the 連結任務 feature from the task list. The underlying data (`Task.
linkedTaskId`/`linkOffsetDays`) and its read-side behavior — `resolveLinkedTaskDates` in `derived.ts`,
`CalendarView`'s drag-disable, `EventDetailModal`'s disabled/auto-following date field — are still in the schema
and still apply to any task that already has a link set.
**Decision**: Removed only the `<select>`/offset-input UI block from `ListView.tsx`'s `TaskRow` (the sole place
that could *create* a link). Left every other linked-task-aware code path alone, since it's not dead — it's
still the correct behavior for whatever data already carries a `linkedTaskId`, and ripping out the schema field
or the read-side logic wasn't asked for and isn't safe without a data migration.
**Consequence**: No UI anywhere can create a new task link going forward. If the feature needs to come back, it
was `ListView.tsx` (removed) — `EventDetailModal.tsx` was never a place you could set the link, only see it.

## 18. Dual view (兩者檢視) stacks vertically below `lg`, checklist panel gained checkboxes

**Context**: While doing a responsive pass, found the "兩者檢視" mode's calendar+list side-by-side layout
(`w-4/5`/`w-1/5`) squeezed `SimpleTaskList` into an unreadable ~70px-wide column on phone-width screens — CJK
text with no `whitespace-nowrap` wrapped to one character per line under that pressure (same underlying bug as
decision below on the schedule-toggle buttons and `ListView`'s category headings).
**Decision**: `flex-col lg:flex-row` on the wrapping div — calendar full-width on top, checklist full-width
below, only side-by-side at `lg:` (1024px+) where a 20% column is actually wide enough. Separately, per the
user's request, added a checkbox to each `SimpleTaskList` item (previously text-only, done-state only showed as
strikethrough) — needed passing `caseId` down to it so it can call `updateCase`.
**Related fix, same root cause**: `ListView.tsx`'s per-category heading row and the schedule view-toggle buttons
in `CaseView.tsx` had the identical CJK-flex-shrink bug (visible as a heading or button label wrapping into a
vertical stack of single characters on a phone-width viewport). Fixed by adding `whitespace-nowrap` to the text
and `flex-wrap` to the row (heading case — the whole heading now wraps as a unit instead of compressing
internally) or by hiding the label below `sm:` and keeping icon+`title` tooltip only (toggle buttons — three
full-width segmented-control labels don't fit a phone screen even on one line each).
**General takeaway**: any CJK text living directly inside a `flex` item without `whitespace-nowrap` is at risk
of this — browsers treat CJK line-break opportunities as between-every-character by default, so flex-shrink's
`min-width: auto` doesn't protect it the way it would for Latin text with spaces.

## 19. Schedule-view font sizes reduced ~15% (`ListView`/`CalendarView`/`SimpleTaskList`)

**Context**: User asked to shrink the 時程管理 (schedule) section's text further ("再幫我縮小15%") — a follow-up
tightening of density, not a new design direction.
**Decision**: Multiplied every `text-[Npx]` value in `ListView.tsx`, `CalendarView.tsx`, and `SimpleTaskList.tsx`
by ~0.85 (rounded to a sane `.5`-ish step), left icon `size={}` props alone (the ask was about font, not icon
scale) and left `SectionLabel`'s "時程管理 · SCHEDULE" heading alone (shared across all three section headers,
not schedule-specific content).

## 20. 招標文件自動判讀 rebuilt again: Anthropic API → rule-based OCR + keyword/regex extraction

**Context**: The user asked whether 招標文件自動判讀 could work without calling any LLM API at all (cost/
dependency concern), specifically via "相似詞" (keyword/synonym) matching instead of AI reading comprehension.
Explored the option space first (a written response, not code): traditional OCR + keyword dictionaries can run
entirely inside a Vercel serverless function (no persistent process); a self-hosted open-source LLM (e.g.
Ollama) cannot — Vercel Functions have no persistent disk or long-running process to host a loaded model, so
that path would require a separately-hosted service reachable over HTTP, which reintroduces the same
"depends on an external service" problem the user was trying to avoid. Given that, the user chose to proceed
with the OCR + keyword path, on a new branch (`feature/ocr-tender-extraction`).
**Decision**: Replaced the Anthropic-API implementation in `src/app/api/extract-tender/route.ts` with a new
`src/lib/tenderExtract/` module: `extractText.ts` (PDF text-layer read via `pdfjs-dist`, with a render-to-PNG +
`tesseract.js` OCR fallback for pages with little/no text layer, and for plain image uploads) and
`parseFields.ts` (keyword/synonym label matching + regex parsing for dates/money/area). Removed
`@anthropic-ai/sdk` and the `ANTHROPIC_API_KEY` env var entirely (added `pdfjs-dist`, `tesseract.js`,
`@napi-rs/canvas` — the last one specifically because it ships prebuilt binaries per platform, unlike `canvas`,
which needs system Cairo/Pango and would need extra work to run on Vercel).
**Validated against real documents, not synthetic test data** — this materially changed the design partway
through:
- Downloaded an actual 招標公告 from 政府電子採購網 and a real 統包工程需求書 (technical spec) to test with,
  rather than trusting hand-written sample text. This caught real bugs hand-written tests wouldn't: (1) the
  real 招標公告 turned out to be a **scanned/rasterized PDF with zero text layer** — the OCR fallback exists
  specifically because of this, not as a speculative feature; (2) real ROC dates are commonly written
  "115/06/25" (slash-separated), not just "114年7月24日" (kanji-separated) — `parseDate` originally only
  handled the latter for ROC years, silently returning `null` for every date field on real documents; (3) OCR
  output glues CJK characters together with stray spaces ("機關名稱" → "機 關 名 稱") and occasionally
  misreads a character entirely ("名稱" → "名般") — the former is fixed by `collapseCjkSpacing`, the latter is
  not fixable by this approach and is an accepted miss (returns `null`, doesn't guess); (4) a short/generic
  label (e.g. "招標機關") can coincidentally appear mid-sentence in unrelated prose — `findLabelLines` now
  only accepts a match within `LABEL_START_TOLERANCE` (20 chars) of its line's start, since a real form label
  is always at/near the start of its line/cell.
- Also tested against the freeform 統包工程需求書 (152K characters, no "label: value" structure at all,
  multiple buildings each with their own floor count/area). Keyword matching produces outright wrong answers
  here (wrong unit, wrong building, coincidental keyword matches), not just misses — confirmed this document
  type is out of scope for this feature; see `CLAUDE.md`'s "招標文件自動判讀" section for what's actually a
  reasonable target (a clean, structured 公開招標公告) versus not.
**Consequence**: No LLM API dependency, no cost per extraction, but a materially lower and less consistent
accuracy ceiling than the Anthropic version had — expected and accepted by the user as the tradeoff for
avoiding an API dependency. Every extracted field is still a draft the user reviews before saving (unchanged
from before), which is what makes shipping this accuracy tradeoff acceptable at all.
