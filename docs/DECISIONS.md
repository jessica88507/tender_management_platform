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

## 21. 案件資訊: 標案形式 field added, 契約模式 became a fixed dropdown, 每坪造價 computed

**Context**: User asked for three specific `InfoPanel` changes: 契約模式 (was free text) should be a dropdown
limited to 最有利標／最低價; a new 標案形式 field (統包工程／私人案); and 契約金額 should be considered together
with 總樓地板面積 — confirmed via a clarifying question that this specifically meant computing and displaying
每坪造價 (cost per 坪), the standard construction-industry unit-cost metric, not just placing the two fields
near each other in the layout.
**Decision**:
- `tenderType` is a new real `cases` column (`text`, default `""`) — not folded into an existing field — for
  the same reason `contractMode` already has its own column: it's a distinct concept from every other 案件基本
  資料 field, and treating it as free text (rather than a config-driven dynamic field system) matches how every
  other field in this section already works. Added straight through the whole stack: `db/schema.ts` →
  migration `0009_greedy_sandman.sql` → `Case` type → `caseMapper.ts` → both `/api/cases` routes → seed data.
- Both `tenderType` and `contractMode` follow the existing "unknown value gets an extra `<option>`" pattern
  already used for 主投標手's select (`InfoPanel.tsx`) — old/imported data that doesn't match either fixed
  option still displays and round-trips correctly instead of silently resetting to blank.
- 每坪造價 is **not** a stored column — pure derived display (`contractAmount / (floorArea / 3.305785)`,
  rounded), computed inline in `InfoPanel.tsx` from the two existing fields. Shown read-only in both view mode
  (a new row in `viewFields`) and edit mode (a disabled input, since there's nothing to directly edit — you
  change the two inputs it's derived from instead). 總樓地板面積's display also gained a "約 X 坪" conversion
  hint (both the read-only view value and a small helper line under the edit-mode input) since the same 3.305785
  conversion factor is directly relevant there too.
**Consequence**: If a case's `contractAmount` or `floorArea` is 0/unset, 每坪造價 shows "—" (view) or an empty
disabled input with a placeholder explaining why (edit) — never a `NaN`/`Infinity` division artifact.

## 22. Calendar highlighted range now ends at 決選廠商, not a hardcoded deadline+14

**Context**: `CalendarView`'s "active range" highlight (non-muted background; days outside it get `bg-muted`)
ended at a hardcoded `addDays(deadline, 14)`, labeled as 施工評選簡報日 in a comment. The user asked for the
range to instead run through 決選廠商 (final vendor decision) — a separate, later milestone
(`taskTemplates.ts`'s `final_vendor` row, `deadline + 15` by default).
**Decision**: Instead of just changing the magic number from 14 to 15, look up the real generated task
(`c.tasks.find(t => t.key === "final_vendor")`) and use *its* `due` date, falling back to `addDays(deadline, 15)`
only if that task is missing (e.g. an admin disabled the rule). This keeps the highlight correct if the rule's
offset is ever changed via the admin 預設排程規則 panel, rather than drifting out of sync with a second
hardcoded copy of the same offset.
**Consequence**: The calendar's footer hint text ("...超出統包啟動會議～決選廠商的範圍...") was updated to match.

## 23. Fixed dragged calendar events getting stuck at opacity-25 ("反白") after a successful move

**Context**: User reported that after dragging a task to a new date on `CalendarView`, the event card would
render washed-out/colorless (`反白`) instead of its normal category-colored appearance, instead of the drag's
intended (correctly-colored) end state.
**Root cause**: `draggingId` (used to apply `opacity-25` to the card being dragged, for visual feedback during
the drag) was only ever cleared in the dragged element's own `onDragEnd` handler. But a successful drop calls
`moveTask`, which changes the task's `due` date — moving that task to a *different* `<td>` in the next render.
React can tear down the original DOM node (the one the browser's native `dragend` event would fire on) before
that event fires, so `onDragEnd` never runs and `draggingId` stays set to the moved task's id forever — the
moved task keeps matching `draggingId === t.id` in its new cell and renders at 25% opacity indefinitely.
**Decision**: Also call `setDraggingId(null)` directly inside the `<td>`'s `onDrop` handler (right after
`moveTask`), not just in `onDragEnd` — this guarantees the state clears on every successful drop regardless of
whether the source element survives to fire its own `dragend`.
**Verification note**: consistent with `DECISIONS.md` #7 — the browser automation tool can't drive native
HTML5 drag-and-drop directly, so this was verified by dispatching real `DragEvent`s (`dragstart`/`dragover`/
`drop`/`dragend`) via JS and checking the moved card's computed `opacity` was back to `1` afterward.

## 24. 提出釋疑 (RFI) now counts forward from 招標公告, not backward from 投標截止

**Context**: `generateTasks`'s `rfi` rule computed its due date as `deadline - 25% of total business days`
(i.e. anchored to, and counting backward from, 投標截止). The user pointed out 提出釋疑 (submitting requests
for clarification) should instead be 25% of the total duration counting *forward* from 招標公告 (start) — a
materially different date, not just the same rule expressed the other direction, since `deadline - 25%` and
`start + 25%` only coincide if the 25%/75% split happens to land symmetrically (it doesn't, in general).
**Decision**: Added `addBusinessDays` (`date.ts`) as the forward counterpart to the existing
`subtractBusinessDays`, and changed the `rfi` rule to `snapToBizDay(addBusinessDays(start, round(totalDays *
0.25)))`. `snapToBizDay` always moves a date *earlier* (see its own doc comment) regardless of which direction
the anchor counts from, so this still lands on a business day, just via "pull back toward `start`" instead of
"pull back toward `deadline`" — updated the template's note text and comment to describe "招標公告後" instead of
"投標截止前".

## 25. New-case onboarding tutorial gained a 5th step: the schedule is a default, not a final answer

**Context**: User asked that, beyond the existing onboarding tour, new cases should carry an explicit reminder
that the auto-generated schedule is the company's standard-process default, and the 主投標手 still needs to
adjust it based on the specific case's experience and real-world circumstances.
**Decision**: Added a 5th `OnboardingTutorial` step (after "第三步：管理時程", before "開始使用") reusing the
same `[data-tutorial="schedule-toggle"]` spotlight target, rather than inventing a separate reminder mechanism
(a second modal, a persistent banner, etc.) — the tour already runs once per new case and is the natural place
a user reads this kind of caveat, and reusing it keeps the "one guided intro, then get out of the way" UX
instead of stacking multiple different first-run interruptions.

## 26. Changing 例行會議固定星期 and clicking regen now actually moves the recurring meetings

**Context**: User found that changing 例行會議固定星期 (recurring meeting weekday) in `InfoPanel` and clicking
"依目前設定調整排程" didn't move the already-generated recurring meeting tasks to the new weekday — the old
ones stayed exactly where they were, and (if the admin regen path were more aggressive) would have simply
accumulated a second set of meetings alongside the first rather than replacing them.
**Root cause**: `generateTasks`'s recurring-meeting `add(...)` call never passed a `key` — every other task
that participates in the regen merge (`InfoPanel.handleRegen`) is matched between the old and freshly-generated
task lists *by key*; with no key, every recurring meeting instance was always treated as `orphaned` (kept
as-is, untouched, forever) by that merge logic, the same category as a genuinely-custom manually-added task.
**Decision**: Gave each recurring meeting instance a stable, index-based key (`meeting_recurring_${i+1}`) so
regen's existing key-matching merge logic (already correct for every other task type — preserves manually-moved
due dates, replaces unmoved ones with the fresh computation) now applies to recurring meetings too. Deliberately
did *not* make the weekday change auto-apply without the regen button — every other `InfoPanel` field already
requires that explicit step (see its own hint text: "調整上方欄位不會自動改動既有任務"), and special-casing just
this one field would be inconsistent with that established, already-documented UX.
**Consequence**: If the old and new weekday produce a different total meeting count, any extra old instances
beyond the new count still show up as harmless orphaned leftovers (a pre-existing, narrower version of the same
edge case every regen-merged task type has) — a real but minor edge case, not chased further here.
**Verification**: confirmed via a direct `generateTasks` + regen-merge script test — weekday 2→4 correctly
moved all instances from Tuesdays to Thursdays (`new Date(due).getDay() === 4`), not just added a second set.

## 27. PPT calendar slide now mirrors CalendarView's actual visual coding, not a text summary

**Context**: The exported PPT's calendar slides rendered each day's tasks as `★ label` / `label` plain-text
lines in one paragraph per cell — no color, no way to tell a task's category at a glance, which the user
called out as "很難判別行事曆上面的任務" (hard to tell tasks apart on the calendar) compared to the web app's
CalendarView, where every task carries a category-colored left border, and milestones get a star + highlight
styling.
**Decision**: Rebuilt each day cell's task list as an array of `TableCell` rich-text runs (pptxgenjs supports
`TableCell.text: string | TableCell[]`, each with its own `options` and `breakLine`) instead of one joined
string: a colored "●" bullet per task in that category's exact color (`CATEGORY_HEX`, sharing the same hex
values as `globals.css`'s light-theme `--color-*` category variables — not this file's own separate chrome
palette, so a color means the same thing on-screen and in the deck), a "★" in `COLOR.highlight` for milestones,
and both dimmed to `COLOR.lineGrey` for done tasks (no strikethrough — pptxgenjs's `TableCellProps` type doesn't
expose `strike`, unlike its `addText` `TextPropsOptions`, so a dimmed color is the fidelity ceiling here).
**Verification**: generated a real PPTX from a synthetic case exercising every category + a milestone + done
tasks, unzipped it (a `.pptx` is a zip), and grepped the slide XML directly for the expected `srgbClr` hex
values and "★"/"●" glyphs — confirmed all 6 category colors plus the highlight color appear as separate colored
runs on the calendar slide, not one plain-colored text block.

## 28. Main content column centered on wide screens (`mx-auto`)

**Context**: User reported a large blank area on the right side when using the app on a bigger monitor.
**Root cause**: `MainView.tsx`'s content wrapper has `max-w-[1240px]` (deliberately, so long lines of text/wide
tables don't stretch uncomfortably far on large screens) but no `mx-auto` — so past 1240px+sidebar of viewport
width, the capped block just sat flush-left inside its `flex-1 <main>`, dumping 100% of the leftover space on
the right instead of splitting it evenly.
**Decision**: Added `mx-auto` to that wrapper. Verified at a 1920px viewport: left and right gaps both measured
exactly 225px (`main`'s available width 1690px − content's 1240px, split /2) — confirms it's now centered, not
just "less obviously wrong."
**Superseded by #29 below** in the same conversation — the user then asked for the content to grow with the
screen instead of being capped, so the `max-w-[1240px] mx-auto` from this entry was removed entirely.

## 29. Main content column made fully fluid-width instead of capped+centered

**Context**: Immediately after #28 shipped, the user clarified the actual ask was for the app's content boxes
to grow with the screen size ("跟著螢幕大小長開，不要固定框框"), not just be centered within a fixed cap.
**Decision**: Removed `max-w-[1240px] mx-auto` from `MainView.tsx`'s content wrapper entirely, leaving only the
existing responsive padding (`py-5 px-4 pb-10 sm:py-8 sm:px-11 sm:pb-15`) — the content now fills whatever width
`<main>` has, with no upper cap.
**Consequence**: On very wide monitors, cards/tables/forms inside `CaseView` now stretch further than the old
1240px cap. None of those components had a max-width or fixed-width assumption of their own, so nothing broke;
if a future component genuinely needs a readable-line-length cap (e.g. a long-form text block), that should be
scoped to that component specifically rather than reintroduced at the `MainView` level.

## 30. Theme default reverted to always-light everywhere; login screen left untouched

**Context**: Mid-session, the user asked for the login screen to guess dark/light from the OS/browser setting
before a session is known, defaulting to light when unknown. This was implemented (`layout.tsx`'s blocking
`beforeInteractive` script + `ClientApp.tsx`'s theme-sync effect both switched to `matchMedia('(prefers-color-
scheme: dark)')`). While investigating how that would look, discovered `LoginScreen.tsx` doesn't actually
consume the app's `data-theme` CSS-variable system at all — it's a fixed dark "sci-fi/BIGMASTER" brand design
built from hardcoded hex colors, so the OS-guess work would never have been visible there anyway. Flagged this
correction to the user explicitly rather than letting the earlier explanation stand uncorrected.
**Decision** (user's explicit call once informed): keep the login screen exactly as-is — it does not participate
in the theme system and never should. For the rest of the app, light is always the default (both before and
after login, for any user without a saved preference); dark mode is reachable only via the in-app toggle a
signed-in user clicks themselves, never guessed from the OS setting. Reverted `layout.tsx`'s init script back to
unconditionally setting `data-theme="light"`, and `ClientApp.tsx`'s effect back to reading only the signed-in
user's own `localStorage` preference (falling back to light, not `matchMedia`).
**Consequence**: The OS-preference-guessing code was net-zero — implemented and reverted within the same
session before being committed — so there's nothing left to clean up on `main`; this entry exists mainly to
record that the OS-guess approach was deliberately rejected, not simply forgotten, should it come up again.

## 31. PPT slide 1 rebuilt as a bilingual 案件基本資料 info table; org chart split into its own slide

**Context**: The user supplied a reference image of the firm's actual bid-proposal deck cover slide and asked
for the exported PPT's first slide to match it exactly ("請按照這樣的設計去放"): an "01 案件介紹 / Project
Introduction" header with an orange "案件基本資料" tab, below which sits a bilingual (Chinese/English) 2-column
key-value table — olive-green label cells, alternating white/light-grey data rows, a full-width dark 工程名稱
header row, and a full-width orange-bulleted 特殊說明 list at the bottom. The old slide 1 (case name + 4 stat
cards + org chart crammed into the same slide) didn't resemble this at all, and the user separately asked for
the org chart to become its own second slide ("第二張是備標團隊的組織圖").
**Decision**: Rewrote `buildSlide1` in `buildPptx.ts` as a `pptxgenjs` table using `colspan` for the full-width
rows and paired label/value cells (via new `labelCell`/`valueCell` helpers) for the rest, sourcing every value
directly from existing `Case` fields (`ownerOrg`, `userUnit`, `contractAmount`, `location`, `contractMode`,
`contractScope`, `supervisorUnit`, `siteArea`, `buildingType`, `floorCount`, `floorArea`, `constructionPeriod`,
`start`/`deadline`, `specialNotes`) rather than inventing new fields — no field in the reference image lacked a
real data source except the reference's example household-count parenthetical, which was left out since no
`Case` field backs it (fabricating a number would be worse than omitting it). Added `fmtMoneyYi` (億-based
contract amount), `fmtAreaWithPing` (㎡ value with a `(N坪)` conversion), and `fmtCostPerPingWan` (the existing
每坪造價 formula from `InfoPanel`, expressed in NTD萬/坪ordinal and shown in red under the contract amount,
matching the reference image's red sub-line) as new pure helpers in this file. `addOrgChart` (unchanged) moved
out of `buildSlide1` into a new `buildOrgChartSlide` function, and `buildProjectPptx` was renumbered:
`TOTAL = 3 + calendarMonths.length`, with slide 1 = info table, slide 2 = org chart, slide 3 = progress/
milestones (renamed from `buildSlide2` to `buildProgressSlide` for clarity), slides 4+ = one per calendar month.
**Verification**: generated a real PPTX from a synthetic case via a direct `tsx` script (bypassing HTTP/auth,
same method as decision #27), unzipped it, and grepped the slide XML — confirmed slide 1 contains every field's
Chinese+English label pair and correctly-formatted value (e.g. `NTD 28.9億元` / `約 NTD 21.23萬/坪` / `基地
6,576.27㎡(1,989坪)`), confirmed the expected `srgbClr` hex values for the olive label cells / orange tab / red
sub-line / alternating grey rows all appear, and confirmed slide 2 now contains only the org chart while slide 3
contains the progress bar + milestone table (previously slide 1 and slide 2 respectively).

## 32. PPT calendar slide fonts scaled +15%; added 本週目標/備註 column

**Context**: The user asked for the exported calendar's font sizes to be 15% larger for readability, and
pointed out a missing 8th column, "本週目標/備註", that exists in the web app's `CalendarView` (backed by
`c.weekNotes[weekKey]`) but was never carried over to the PPT version.
**Decision**: Added a local `F(n) = round(n * 1.15 * 100) / 100` helper inside `buildCalendarSlide` and applied
it to every font size specific to the calendar grid itself (weekday header, date numbers, task bullets/labels,
the "+N 項" overflow note) — deliberately *not* to the shared chrome (`addChrome`/`addSectionTitle`, used by
every slide type) or the 逾期事項 sidebar, since the user's request was specifically about "行事曆的產出" (the
calendar grid's own output), not the whole deck. For the new column: `CalendarView.tsx` computes each week's
`weekKey` as `toISO()` of that week's leading Sunday and looks up `c.weekNotes[weekKey]` — `reportData.ts`'s
`buildMonthGrid` already produces weeks as arrays of 7 `CalendarDay`s starting from that same Sunday, so
`week[0].iso` is already the identical key with no new plumbing needed in `reportData.ts`. Added an 8th column
(`colW` now `[...7 day columns, wider note column]`) to both the header row and each week's row, pulling
`c.weekNotes[week[0].iso] || ""` directly.
**Verification**: same direct-script + unzip/grep method — confirmed `sz="1150"`/`"1035"`/`"920"` (10/9/8 × 1.15)
appear in the calendar slide XML where the old `"1000"`/`"900"`/`"800"` values used to be, confirmed the header
row's 8th cell reads "本週目標/備註", and confirmed two test notes seeded at different weeks (`2026-06-14`,
`2026-07-05`) each landed on the correct month's slide.

## 33. 招標文件自動判讀 route given an explicit 60s `maxDuration`

**Context**: The user reported the upload/auto-extract feature still failing after testing again — this time
confirmed to be on the deployed Vercel URL specifically (a local test of the same real document had already
succeeded earlier this session). OCR via `tesseract.js` can take 7-9+ seconds per scanned page, and
`tesseract.js` re-downloads its `chi_tra+eng` language data on every cold start (its `cachePath` is pinned to
`/tmp`, which Vercel doesn't persist between invocations) — a multi-page scanned upload can plausibly exceed
Vercel's serverless function default timeout well before extraction finishes, which would surface to the user
as exactly this kind of generic "can't recognize the document" failure.
**Decision**: Added `export const maxDuration = 60;` to `src/app/api/extract-tender/route.ts`. This doesn't
rule out other causes (e.g. `@napi-rs/canvas`'s prebuilt binary needing to match Vercel's Lambda platform), but
it's a real, verifiable gap in the code as it stood, and removing it costs nothing. If the user still sees the
failure after their next deploy, the next step is pulling the actual error from Vercel's function runtime logs
(Project → Logs), since that's the only way to see what's actually thrown in that environment — it can't be
reproduced locally.

## 34. Architect org-chart branch is titled by the partner firm's name, not a fixed label; mep/jianguo mismatch fixed

**Context**: The user clarified their earlier garbled message: on the 備標團隊 org chart, they want the
architect branch's box to be titled with whichever architecture firm/person they typed in (the first name
entered under 建築師), sitting at the same hierarchy level as 建國工程團隊 — not nested as just another member
card underneath a permanently generic "建築師團隊" label. Unlike the architect branch, 建國工程團隊 is the
firm's own fixed in-house team and correctly stays a constant label. While implementing this, found a real
pre-existing bug in `buildPptx.ts`'s `addOrgChart`: it merged `c.team.mep` into the *architect* branch's member
list and left the jianguo branch showing only `team=jianguo` consultants — inconsistent with `TeamPanel.tsx`'s
own web-app rendering (architect branch = `team.architect` + `team=architect` consultants; jianguo branch =
`team.mep` + `team=jianguo` consultants). MEP staff were silently appearing under the wrong branch in every
exported deck.
**Decision**: In both `TeamPanel.tsx` (the web org-chart display) and `buildPptx.ts`'s `addOrgChart`, the
architect branch's title is now `c.team.architect.filter(Boolean)[0]` (falling back to the generic "建築師團隊"
label when empty), with any remaining architect names + `team=architect` consultants listed as members below
it. Fixed the mep/jianguo mismatch in the same pass so `c.team.mep` now correctly feeds the jianguo branch in
the PPT, matching the web app. Added a placeholder hint ("建築師團隊名稱（例如：OO建築師事務所）") on the first
architect-name input in `TeamPanel`'s edit form, plus a one-line explanation, so it's clear why that first entry
is treated specially.
**Verification**: `npx tsc --noEmit` and `npx eslint` clean on both files. Regenerated the test PPTX (same
direct-script method) with `team.architect: ["李工程師", "陳建築師"]` and `team.mep: ["張技師"]` — confirmed
slide 2's left box is now titled "李工程師" (not "建築師團隊") with "陳建築師、結構技師（…）" listed beneath it,
and the right box ("建國工程團隊") now correctly includes "張技師" alongside the jianguo consultant, where it
was previously missing entirely.
**Superseded by #35 below** in the very next message — the user clarified the "first name = title" hack (the
UX hint I added in #34) still put a case-specific team name inside a section headed by a fixed, generic
"建築師團隊" label, which read as an odd hierarchy; they wanted a properly separate field instead.

## 35. Login screen switched to light theme; architect team gets a dedicated name field; org chart supports an optional 3rd branch

**Context**: Three related asks in one message. (1) The user reversed an earlier decision and now wants
`LoginScreen.tsx` in light theme (previously explicitly "don't touch it," kept as a fixed dark brand design —
see decision #30). (2) Screenshot feedback on #34's "first array entry becomes the org-chart title" hack: the
user found the resulting hierarchy confusing — the edit box is still headed by the fixed "建築師團隊" label
while one particular input inside it silently becomes a different, more prominent title elsewhere (the org
chart) — and asked for one dedicated input for the architect team's name, positioned outside/above that member
list rather than nested inside it. (3) 機電團隊 is sometimes an external JV company that's also entrusted with
work on the case, so the user wants 備標團隊's second tier to support up to 3 branches instead of a hardcoded 2 —
but when there's no JV company, nothing should change (機電 keeps folding into 建國工程團隊 as it already does).

**Decision**:
- `LoginScreen.tsx` recolored from its hardcoded dark palette to the equivalent hardcoded **light** hex values
  taken directly from `globals.css`'s light-theme `--color-*` variables (e.g. background `#050b12`→`#f1f5f9`,
  accent `#38bdf8`→`#0284c7`) — same structure/motifs (compass badge, corner brackets, blueprint grid, scanning
  line), just recolored. Still not wired to `data-theme` (this screen renders before a session — and therefore
  a saved preference — exists), consistent with the app's own light-by-default behavior (#30).
- Added `architectName: string` to `Team` (`types.ts`), backed by a new `cases.architect_team_name` column
  (not `teamMembers`, since it's one string per case, not a repeatable list) — the org-chart title for the
  architect branch now reads from this dedicated field, never from `architect[0]`. `TeamPanel.tsx` gained a
  standalone labelled input for it, placed *above* the two team-box row (not nested inside the 建築師團隊 box),
  with inline copy explaining it mirrors 建國工程團隊's hierarchy level.
- Extended `TeamGroup` to `"architect" | "jianguo" | "extra" | null` and added `extraName: string` /
  `extraMembers: string[]` to `Team`, backed by a new `cases.extra_team_name` column and a 3rd `"extra"` value
  on both the `team_group` and `simple_team_kind` Postgres enums (`ALTER TYPE ... ADD VALUE`, migration
  `drizzle/0010_bumpy_rumiko_fujikawa.sql`). The 3rd branch is opt-in in `TeamPanel.tsx`: a "+ 新增第三個團隊"
  button reveals a self-contained box (its own name field + member list + consultant drag-drop target) only
  when clicked, with a "移除此團隊" action that clears `extraName`/`extraMembers` and un-assigns any
  `team === "extra"` consultants back to unclassified. `buildPptx.ts`'s `addOrgChart` was generalized from a
  hardcoded 2-box layout to an N-box layout (`branches: {title, names}[]`, N = 2 or 3) so the same optional
  branch renders in the exported deck; the 2-branch gap (0.6") is kept for the default case so a case with no
  JV team looks pixel-identical to before, with a tighter 0.35" gap only when a 3rd box is present.
- Every other reference to the team model (`normalizeTeam`, `getOwnerOptions` in `scheduler.ts`, `caseMapper.ts`,
  both `POST`/`PATCH /api/cases` routes, `db/seed.ts`) updated in the same pass — see the full map an Explore
  agent produced before this change, confirming exactly two Postgres enums (`team_group`, 2 values;
  `simple_team_kind`, 2 values) and no runtime/zod validation anywhere in the API layer (enforcement is
  entirely the Postgres enum constraint) were the only hard constraints on adding a 3rd value.
**Verification**: `npx tsc --noEmit` and `npx eslint` clean across the whole project. Ran the real migration
against the local `docker compose` Postgres (`npm run db:generate` + `db:migrate`) and reseeded. Regenerated
the direct-script test PPTX for both a 2-branch case and a 3-branch (JV MEP) case — confirmed the JV branch only
appears in the latter, with its own title/members, and the default case's layout is unchanged. Logged into the
running dev server as the demo account and drove the real `TeamPanel` UI end-to-end: confirmed the light login
screen, confirmed the standalone architect-name field renders above (not inside) the member-list box, added and
then removed a 3rd team live and watched the org chart go from 2→3→2 branches correctly, then reverted the test
edits so no test data was left on the (real, non-demo) case used for the walkthrough.
**Superseded by #36 below**, in the very next message — the standalone field from this entry was itself the
thing the user objected to.

## 36. Architect/3rd-team names edited inline in their own box header, not a separate field; 3rd-team slot sits in the same row

**Context**: Sharp, immediate pushback on #35's standalone "建築師團隊名稱" box (screenshot attached): having a
separate labelled field above the team-box row was exactly the kind of disconnected-hierarchy layout the user
had already objected to once — the name still didn't live where it visually applies. The ask was explicit:
(1) delete that standalone box entirely, (2) make the team name directly editable *in the box's own title*,
and (3) the "add 3rd team" affordance must sit in the same row as 建築師團隊/建國工程團隊 (side by side), not as
a full-width button below them with explanatory paragraph text.
**Decision**: `TeamBox` (`TeamPanel.tsx`) gained optional `titlePlaceholder`/`onTitleChange`/`onRemove` props —
when `onTitleChange` is passed, the box's header itself renders as an inline text input (dashed underline,
turns solid accent-colored on focus) instead of a static label; `onRemove` renders a small × icon inline in
the header instead of a separate "移除此團隊" text link. Removed the standalone architect-name box completely.
Added a new `AddTeamBox` ghost-button component, sized and styled to match `TeamBox` (`flex-1 min-w-[260px]`),
so it renders as the 3rd flex item in the same row when there's no 3rd team yet — clicking it calls the same
`addExtraTeam` as before, which swaps it for a real (now inline-titled, removable) `TeamBox`. 建國工程團隊 keeps
its plain fixed-text header (no `onTitleChange`) since it's still always the firm's own fixed team, unaffected
by this change. A single short caption line replaced the old paragraph-length hint.
**Verification**: `npx tsc --noEmit` / `npx eslint` clean project-wide. Re-verified live in the running dev
server: all 3 boxes (architect / 建國工程團隊 / add-3rd-team ghost box) render side by side in one row; typing
directly into the architect and 3rd-team box headers persists and shows correctly in the read-mode org chart;
removing the 3rd team via its inline × correctly collapses it back to the ghost "+ 新增第三個團隊" box. Test
data reverted afterward, same as the #35 walkthrough.

## 38. pdfjs-dist worker file missing from the Vercel serverless bundle

**Context**: The error-surfacing fix (#37's sibling change) paid off immediately — the user's next test
returned the real underlying exception: `Error: Setting up fake worker failed: "Cannot find module
'/var/task/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs' imported from
/var/task/node_modules/pdfjs-dist/legacy/build/pdf.mjs'."`. `pdfjs-dist`'s Node ("legacy") build has no
real `Worker` available inside a serverless function, so it falls back to a "fake worker" by dynamically
`import()`-ing its own `pdf.worker.mjs`, computed relative to its own module location at runtime. Vercel's
build does static file-tracing to decide which `node_modules` files actually ship in a serverless function's
deployed bundle — a dynamic import like this is invisible to that static analysis, so the worker file
silently gets dropped even though the rest of `pdfjs-dist` is present (this is a known class of issue with
`pdfjs-dist` specifically on serverless platforms, not specific to this app's setup).
**Decision**: Added `outputFileTracingIncludes: { "/api/extract-tender": ["./node_modules/pdfjs-dist/legacy/
build/pdf.worker.mjs"] }` to `next.config.ts` — Next.js's documented mechanism for exactly this "a dynamic
import needs a file the tracer can't see" situation, scoped to just this one route rather than broadening
`serverExternalPackages` or reaching for a workaround inside `extractText.ts` itself.
**Verification limitation**: `npx tsc --noEmit` / `npx eslint` clean, and the dev server still starts fine
with the new config key. Could **not** fully dry-run via `npm run build` locally — it fails on an unrelated,
pre-existing issue (`next/font/google` under Turbopack tries to resolve `@vercel/turbopack-next`, a package
that's only injected inside Vercel's own build containers, not available to a plain local `next build`).
Confirmed this isn't a network problem (outbound HTTPS works fine in this environment) — it's a genuine gap
in what a local build can exercise for this project, pre-dating this change. This fix targets the exact error
string the user reported and uses Next's own documented API for it, but still needs a real Vercel redeploy +
retest to confirm, same as every other production-only fix in this doc.

**Context**: User reported the feature still "doesn't work" after deploying, with a screenshot showing the
"已自動帶入判讀結果" success dialog. Reading `InfoPanel.tsx`'s `handleExtract` found a real bug unrelated to
OCR/parsing accuracy: the success alert was gated only on `res.ok` (the HTTP response), not on whether
`parseTenderFields` actually matched anything — if OCR ran fine but extracted zero recognizable fields (a
scanned/freeform document, a label OCR misread, etc., all documented as accuracy limits in `CLAUDE.md`), the
UI would still cheerfully claim success with every field silently unchanged. This makes a real parsing failure
indistinguishable from a real success, which is worse than an explicit error — the user has no signal to know
whether to trust the (empty) result or manually fill in the form.
**Decision**: Count how many fields actually got assigned inside the same `updateCase` callback (`filledCount`),
and branch the alert on it: `0` → "文件已讀取，但沒有辨識出任何欄位，請手動填寫" (explicitly not a success);
`>0` → "已自動帶入 N 個欄位的判讀結果" (states exactly how many, so a partial extraction isn't mistaken for
a complete one either).
**Consequence**: This doesn't fix any underlying OCR/timeout/platform issue on Vercel (still unverified without
access to the user's deployment logs) — it fixes the UI lying about the outcome. If the user still sees "0
個欄位" after this ships, that's a real, honestly-reported extraction failure worth investigating further
(e.g. via Vercel's function logs), not a UI illusion of success.

## 39. Case saves are debounced full-object overwrites with no unload-flush or conflict detection

**Context**: User reported cases/edits "disappearing" — reverting to older content on reopen, as if the
database "changes on its own." Reading `AppContext.tsx`'s save path (`persistCase`/`applyCaseUpdate`) found
two real, independent bugs: (1) every edit is debounced 400ms before it's sent to `PATCH /api/cases/[id]`, and
nothing flushes that pending save if the tab closes/navigates away first — the edit is just silently dropped,
never sent; (2) the PATCH replaces the *entire* case row (plus wholesale delete+reinsert of its tasks/team/
consultants/weekNotes) with whatever the client's local in-memory copy looks like — there was no check that
the row hadn't been saved by someone else (another tab, another person, a long-idle stale tab) since this
client last fetched it. Whichever save happened to land last would silently overwrite anything saved in
between, with zero warning — exactly "reverts to old content."
**Decision**:
- Added `updatedAt: string` to the `Case` type (`caseMapper.ts`'s `rowToCase`, both `POST`/`PATCH /api/cases`
  routes). `PATCH` now compares the client-sent `updatedAt` against the row's actual current `updatedAt`
  before writing — a mismatch means someone else saved in between, and the request is rejected with `409`
  instead of overwriting (a case loaded before this shipped sends no `updatedAt` at all, so the check is
  skipped for those rather than hard-failing every save until every open tab happens to reload — pure upgrade
  path, no forced-refresh moment). On success, the new `updatedAt` is returned and echoed into local state, so
  the client's *own* next save doesn't spuriously conflict with itself.
- `AppContext.tsx`'s `persistCase` was refactored so the actual send logic (`sendSave`) is shared between the
  normal 400ms-debounced path and a new `beforeunload`/`pagehide` listener that flushes any still-pending save
  immediately via `fetch(..., { keepalive: true })` — `keepalive` is what lets the request actually complete
  after the page starts unloading, unlike a plain `fetch` the browser can cancel mid-flight on navigation.
- On a `409`, the client re-fetches that one case fresh from the server (discarding the stale optimistic local
  state that couldn't be saved anyway) instead of retrying the same payload, which would just conflict again.
**Verification**: `npx tsc --noEmit` / `npx eslint` clean. Live-tested against the real dev server + Postgres:
crafted a PATCH with a deliberately stale `updatedAt` via `fetch` from the browser console — confirmed `409`
with the conflict message and no data change; confirmed a PATCH with the current `updatedAt` still succeeds
normally and returns a fresh one.

## 40. Case deletion restricted to admin; member-facing 專案管理 floating button removed

**Context**: User asked that only the system administrator be able to delete a case, and that the member-facing
floating "專案管理" button (bottom-left, opening `ProjectManagerModal` — a cross-case table with 開啟/刪除 per
row) be removed entirely, rather than just hiding its delete action.
**Decision**: `DELETE /api/cases/[id]` now checks `session.user.role === "admin"` before anything else (no
longer `canEditCase`/case-ownership based) — enforced server-side, not just hidden in the UI. Removed the
floating button, `ProjectManagerModal` usage, and its `showManager` state from `ClientApp.tsx`'s member
`AppShell`; deleted `ProjectManagerModal.tsx` outright (no other caller) along with `deleteCase` from
`AppContext.tsx`'s public API (dead code once its only caller was gone). Added a 刪除 column to
`AdminProjectsPanel.tsx` (previously read-only) — same confirm-then-DELETE pattern the old modal used, via
`useConfirm()` (available since `ClientApp.tsx` already wraps `AdminShell` in `ConfirmProvider`).
**Verification**: `npx tsc --noEmit` / `npx eslint` clean. Logged into the real dev server as both a member and
the admin account: confirmed the floating button is gone from the member view; confirmed `AdminProjectsPanel`
now renders a working 刪除 button; confirmed via direct `fetch` calls that a member's `DELETE` call gets `403`
("只有系統管理員能刪除案件") while the admin's succeeds (tested against a nonexistent id to avoid touching
real data — got the expected `404` past the role check, proving the check itself passes for admin).

## 41. Self-hosted-LLM Q&A assistant (系統助理) — read-only by construction, no tool-calling

**Context**: User wants a Copilot-style floating chat button for asking natural-language questions about their
case/schedule data, explicitly **not** an agent that performs actions — "我現在目標沒有要這個模型幫我做事，我
只需要有一個地方可以讓我去做詢問" (the goal isn't for the model to do things for me, I just need somewhere to
ask questions). To avoid Anthropic API cost/dependency, the user set up their own local model this session:
`qwen2.5:14b` via Ollama on their Mac, fronted by a small hand-rolled Node auth proxy (Ollama itself has no
built-in auth) at `/Users/chenpinjie/Documents/code/local-llm-proxy`, exposed to the internet via a Cloudflare
Tunnel (`cloudflared tunnel --url ...`, a free anonymous `trycloudflare.com` HTTPS endpoint) since Vercel's
serverless functions run in Vercel's cloud, not on the user's LAN.
**Decision**:
- New `POST /api/assistant/chat` (`src/app/api/assistant/chat/route.ts`): takes the conversation history +
  `activeCaseId`, builds a system prompt from that case's real data (`src/lib/assistantContext.ts`'s
  `buildCaseContext`/`buildAllCasesSummary` — compact plain-text summaries, not raw JSON, both for token cost
  and because a 14B model follows prose-shaped context more reliably than deeply nested JSON) fetched
  server-side from Postgres (never trusting a client-supplied case blob), then forwards to the local model's
  Ollama-compatible `/api/chat` endpoint via `LOCAL_LLM_URL`/`LOCAL_LLM_SECRET` env vars.
- The system prompt explicitly and repeatedly states the assistant cannot perform any action (create/edit/
  delete anything) and must say so + point the user back to the UI if asked to "do" something — this is the
  *only* thing enforcing the "Q&A only" scope, so it has to stay explicit if the prompt is ever changed, not
  left implicit or assumed from the absence of tools.
- `src/components/AssistantChat.tsx`: floating button positioned directly below `AlertBanner`'s bell
  (`top-36` vs. the bell's `top-20`, same `right-4.5`) so they stack without overlapping regardless of whether
  a case is active — this button is mounted at the `AppShell` level (always present), while the bell only
  renders inside `CaseView`. Chat history lives in local component state only (no persistence across reloads),
  non-streaming (a single "思考中…" wait state) for simplicity — proportionate to actual usage of an internal
  Q&A tool for a small team, not something that needs streaming UX polish.
- `maxDuration = 60` on the route (same reasoning as the tender-extraction route: a self-hosted model over a
  home/office connection is much slower and less predictable than a hosted API).
- Added `LOCAL_LLM_URL`/`LOCAL_LLM_SECRET` to `.env` (real values, gitignored) and `.env.example` (placeholders
  + explanation). **Still needs the same two added to Vercel's project env vars for production** — not
  something that can be done from this environment.
**Verification**: `npx tsc --noEmit` / `npx eslint` clean. Live end-to-end test against the real local model
through the actual Cloudflare Tunnel: asked "這個案子還剩幾天？主投標手是誰？" while viewing a real case and
got a correctly-grounded answer matching the case's actual displayed data (not a hallucination). Separately
asked it to change the case's contract amount — confirmed it refused and pointed back to the UI, exactly per
the read-only scoping in the system prompt, rather than claiming to have done it.

## 42. 招標文件自動判讀's field extraction now prefers the local LLM over regex, with automatic fallback

**Context**: With the self-hosted `qwen2.5:14b` already wired up for 系統助理 (#41), the user asked whether the
same local model could also replace `parseFields.ts`'s keyword/regex matching for 招標文件自動判讀 — the
regex approach's accuracy limits (documented in `CLAUDE.md`: unreliable on freeform/non-standard layouts, a
label OCR misread just returns null) are exactly the class of problem an LLM generalizes past.
**Decision**: OCR/text extraction (`extractTenderText`) is unchanged — only what parses the resulting text
changed. New `src/lib/tenderExtract/parseFieldsWithLLM.ts` (`extractFieldsWithLLM`) sends the extracted text
(capped at 8000 chars — real documents never need more; this is the header/basic-info section, never the
tail) to the local model's `/api/generate` with Ollama's `format: "json"` mode plus an explicit prompt
covering the exact same 15 fields as `TenderFields`, with the same ROC-year and 億/萬-money conversion rules
`parseFields.ts` already encodes in regex form, spelled out in prose instead. Every returned value is
type-checked against its expected field type (number fields coerced to `null` if not a finite number, text
fields trimmed/length-capped) before being trusted — the model returning valid JSON doesn't guarantee it
matches the schema, `format: "json"` only guarantees syntactic validity. Also ported `parseFields.ts`'s
"buildingType falls back to floorCount" rule (the two fields describe overlapping information in most real
documents), since the LLM path was initially leaving `buildingType` null in exactly the cases the regex
version's fallback exists for.
`extract-tender/route.ts` tries `extractFieldsWithLLM` first; **any** failure (env vars unset, network error,
invalid JSON, the user's machine being off) is caught and silently falls through to the existing
`parseTenderFields` regex parser rather than failing the request — a down/unreachable self-hosted model must
never regress the feature below what it already did before this existed. The response now also reports
`method: "llm" | "regex"`, surfaced in `InfoPanel`'s success alert so the user can tell which one actually ran.
**Verification**: `npx tsc --noEmit` / `npx eslint` clean. Ran `extractFieldsWithLLM` directly (via a throwaway
`tsx` script, bypassing the HTTP layer — same method used throughout this project for testing server-only
code) against a realistic synthetic 政府電子採購網 tender announcement covering every field, including ROC
dates ("114年06月10日"), a 億+萬 mixed amount ("新台幣18億5,000萬元"), and a time-of-day deadline. Got all 15
fields back correct on the first pass except `buildingType` (null); after adding the floorCount fallback,
re-ran and got all 15/15 fields correct.
