# PROGRESS.md — Development Progress Log

> Newest entries at the top. Append a new batch when finished; don't rewrite history. See `DECISIONS.md` for
> the reasoning behind each item.

---

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
