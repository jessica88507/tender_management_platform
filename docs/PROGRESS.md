# PROGRESS.md — Development Progress Log

> Newest entries at the top. Append a new batch when finished; don't rewrite history. See `DECISIONS.md` for
> the reasoning behind each item.

---

## 2026-07-28 — 招標文件自動判讀 rebuilt without an LLM API (branch `feature/ocr-tender-extraction`)

- [x] Replaced the Anthropic-API-based extraction in `src/app/api/extract-tender/route.ts` with a rule-based
      pipeline in new `src/lib/tenderExtract/` module: PDF text-layer read (`pdfjs-dist`) with a scanned-page
      OCR fallback (`pdfjs-dist` render-to-PNG via `@napi-rs/canvas` + `tesseract.js`), then keyword/synonym +
      regex field parsing. Removed `@anthropic-ai/sdk` and `ANTHROPIC_API_KEY` entirely. See `DECISIONS.md` #20.
- [x] Validated against two real downloaded documents (not hand-written samples): a real 招標公告 (turned out
      to be a scanned PDF — motivated the OCR fallback) and a real 統包工程需求書 (confirmed this document
      type is out of scope for keyword extraction — freeform, no label:value structure, multiple buildings).
      Found and fixed real bugs this surfaced: ROC dates written with slashes ("115/06/25") weren't parsed at
      all; OCR glues CJK characters together with stray spaces; a short generic label can coincidentally match
      mid-sentence in unrelated prose (now requires the match near its line's start).
- [x] `tesseract.js`'s OCR language-data cache pinned to `/tmp` (the only writable path on Vercel's serverless
      functions) — previously defaulted to the project's cwd, which is read-only there and, before that,
      accidentally left 7MB of `.traineddata` files sitting in the repo root during local testing (now
      gitignored too).
- [ ] Known, accepted accuracy limits (not further pursued this round): a label whose text OCR misreads
      (e.g. "機關名稱" → "機關名般") returns `null` rather than a guess; dense OCR'd tables where multiple
      original rows get merged onto one text line can still produce an over-long/run-on value for some
      fields. Both are documented in `CLAUDE.md` and `DECISIONS.md` #20.

## 2026-07-28 — Consultant edit/delete, 招標公告/投標截止 alert cleanup, mobile responsive fixes, font sizing

- [x] Fixed 招標公告/投標截止 (milestone `collect`/`deadline`) still nagging as if they were overdue action
      items: `ProgressPanel`'s milestone card flashed red forever once the date passed, `CalendarView` pulsed
      the day cell + flashed the event card, and `urgentTasks()` (警示提醒 bell) surfaced them whenever due
      "soon"/today. All four now route through `isNonCheckableTask` consistently — see `DECISIONS.md` #15.
- [x] `TeamPanel`'s 專業顧問明細 table: the 13 default consultant rows (`custom: false`) could only have
      company/contact filled in, never renamed or deleted — only user-added rows could. Unlocked both for every
      row; fixed a follow-on bug where `normalizeTeam` silently resurrected deleted defaults on next case open
      (see `DECISIONS.md` #16).
- [x] Removed the 連結任務 (linked-task) creation UI from `ListView`'s task rows per user request — the
      underlying `linkedTaskId` data and its read-side behavior elsewhere (CalendarView, EventDetailModal,
      `resolveLinkedTaskDates`) are untouched. See `DECISIONS.md` #17.
- [x] Added a checkbox to `SimpleTaskList` (the 兩者檢視 companion list) so tasks can be checked off directly
      there, not just via CalendarView/ListView.
- [x] Mobile responsive fixes found during a phone-width (390px) pass: the fixed 警示提醒 bell overlapped the
      "你並非本案主投標手" banner text; the schedule view-toggle buttons and `ListView` category headings
      wrapped their CJK labels into a vertical single-character stack under width pressure; 兩者檢視's
      side-by-side layout squeezed the checklist into an unreadably narrow column. See `DECISIONS.md` #18.
- [x] Shrank `ListView`/`CalendarView`/`SimpleTaskList` font sizes ~15% per user request (density pass — see
      `DECISIONS.md` #19).
- [x] `next.config.ts`: `allowedDevOrigins` now derives from `os.networkInterfaces()` at server startup instead
      of a hardcoded LAN IP, so dev-server access from a phone/other device on the network keeps working across
      network changes without re-editing config.
- [ ] `ANTHROPIC_API_KEY` in `.env` is still blank — user asked why 招標文件自動判讀 doesn't work; answer is
      simply that no key has been added yet (get one from console.anthropic.com). Not something to fix in code.

## 2026-07-25 — Database wiring, Prisma→Drizzle switch, redesign pass, admin role

- [x] Switched the ORM from Prisma to Drizzle at the user's explicit request, mid-migration: removed `prisma/`,
      `prisma.config.ts`, `src/generated/prisma`, `src/lib/prisma.ts` entirely; rebuilt schema/client/adapter on
      Drizzle (`src/db/schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `@auth/drizzle-adapter`). See
      `DECISIONS.md` #12.
- [x] Real authentication: NextAuth (Auth.js) v5 credentials provider, bcrypt password hashing, JWT sessions,
      department-gated `authorize()`. Replaced the old mock sign-in state in `LoginScreen`/`ClientApp`.
- [x] Case CRUD fully backed by Postgres: `GET/POST /api/cases`, `PATCH/DELETE /api/cases/[id]`, all inside
      Drizzle transactions. Ownership enforced via `bidLeadUserId` (null = unclaimed/editable by anyone, who
      then becomes the claimant on next save).
- [x] Rewrote `AppContext` to fetch/save through the API instead of `localStorage` (see `DECISIONS.md` #13) —
      verified end-to-end via direct `psql` queries that writes from the UI (e.g. toggling a task's `done`
      checkbox) actually persist to Postgres.
- [x] Redesign pass using the `ui-ux-pro-max` skill properly (actually ran its `search.py` tool this time, after
      user feedback that the first attempt skipped it): restructured `CaseView` into three labeled sections
      (案件總覽/案件設定/時程管理), added a `Header` + `MainView` split that didn't exist before, fixed
      Sidebar/MainView sharing one scroll region instead of scrolling independently (`min-h-screen` → `h-dvh
      overflow-hidden`), applied the skill's one genuinely-applicable finding (missing focus-visible states)
      across interactive elements.
- [x] Added a system-administrator role (`users.role`, migration `0002_steady_psylocke.sql`): admin accounts
      bypass the 業務部 department gate, get routed to a new `AdminShell` with two sidebar sections — **系統
      成員** (`MembersPanel` — add/list/delete member accounts via `/api/users`) and **專案管理**
      (`AdminProjectsPanel` — read-only list of every case, reusing `GET /api/cases`). Seeded an admin account
      (`admin@example.com` / `admin2026`). See `DECISIONS.md` #14.
- [x] Verified end-to-end in-browser as both roles: member login → case view renders correctly; admin login →
      member list loads, add-member round-trips to Postgres (confirmed via `psql`), delete-member round-trips
      too, all-projects list renders real case data.

## 2026-07-25 — Full UI redesign: Tailwind + login screen + doc conventions

- [x] Installed the third-party Claude Code skill `ui-ux-pro-max` (a design-intelligence database; source
      verified as `github.com/nextlevelbuilder/ui-ux-pro-max-skill` — open source, no suspicious install
      scripts or network calls).
- [x] Established doc conventions: `docs/PROGRESS.md` (this file), `docs/DECISIONS.md`, `docs/MEMORY.md`,
      `docs/USAGE.md`, `docs/PROJECT_SPEC.md` (original spec copied in verbatim).
- [x] Added a "large UI redesign workflow" section to `CLAUDE.md`.
- [x] Built the Prisma seed script (reuses the `generateTasks` scheduling engine).
- [x] Tailwind v4 `@theme` color/font theme setup (`src/app/globals.css`, renamed `next/font` variables to
      `--font-sans`/`--font-serif`/`--font-mono` so Tailwind's built-in font utilities pick them up directly).
- [x] Login screen component (`src/components/LoginScreen.tsx`) — UI only; OAuth logic explicitly labeled as
      pending the Azure AD Client ID, gates `ClientApp` behind local (non-persisted) sign-in state.
- [x] Rewrote every component to Tailwind utility classes + `@phosphor-icons/react` icons (replacing all
      bespoke CSS classes and emoji-as-icon usage); `globals.css` reduced to just the `@theme` block plus the
      handful of `@keyframes` Tailwind can't generate.
- [x] Screenshot-loop visual verification: login screen, dashboard header/alert/progress, info panel, team
      panel (view + edit + drag-classify), list view, calendar view, new-case form, project manager modal, and
      confirm-dialog all checked in-browser — no console errors, no leftover bespoke class references.

Also excluded the bundled third-party skill directories (`.claude/`, `.agents/`, `.windsurf/`) from ESLint's
scope — their vendored scripts aren't our source code.

## 2026-07-24 — Database schema design

- Installed Docker Desktop (hit a macOS Gatekeeper false-positive blocking `com.docker.vmnetd` as malware,
  caused by stale `/Library/PrivilegedHelperTools/com.docker.*` files from a prior install — resolved with a
  clean reinstall).
- Created `docker-compose.yml`, running PostgreSQL 16 locally (container: `bid-scheduler-db`).
- Installed Prisma 7 + `@prisma/adapter-pg`, designed the full schema: `users`/`accounts`/`sessions`/
  `verification_tokens` (standard NextAuth tables) + `cases`/`tasks`/`team_members`/`consultants`/`week_notes`
  (domain tables).
- Ran the initial migration (`20260724155035_init`) — all 10 tables created and verified.

## 2026-07-24 — System fixes (user feedback batch 1)

- Overall-progress milestone markers: flags → animated dots (color/pulse by urgency), progress track gained a
  time-pressure gradient.
- Calendar day cells capped at 3 events, with a "+N expand" button beyond that.
- List view got item numbers (sequence after sorting by due date).
- Team panel redesign: edit mode became side-by-side 建築師團隊/建國工程團隊 drop-zone boxes; view mode
  became an org-chart tree.

## 2026-07-24 — Initial Next.js port

- Ported the user-provided single HTML file (`bid_scheduler.html`) to a Next.js 15 (App Router) + TypeScript
  project.
- Fully migrated the scheduling engine (`generateTasks`), the 6 task categories, the 9 tracked milestones, list
  view, calendar view (drag-to-reschedule, add-event modal), case info panel, team panel, project manager
  modal, and custom confirm/alert modals.
- State management: React Context + `localStorage` (kept the original `bid-cases` key).
- Visual style (official-document/chop-stamp motif, colors, fonts) fully reproduced with bespoke CSS.
- Not ported: tender-document PDF auto-parsing (the original approach needed a hardcoded Anthropic API key in
  the frontend, which is unsafe — decided to wait for a backend proxy layer).
- Set up the git repo, `CLAUDE.md`, and `.claude/launch.json` (for the browser preview tool's dev server).
- Verified in-browser: case creation, list/calendar toggle, checkbox progress updates, project manager
  open/delete — all working, no console errors.
