# MEMORY.md — Project Context & Outstanding Items

> For anyone picking up this project cold (including future me). This holds "unresolved, will definitely be
> needed" items — not full technical docs (that's `CLAUDE.md`) or decision rationale (that's `DECISIONS.md`).

## Currently blocked / waiting on external input

1. **Microsoft Entra ID (Azure AD) App Registration doesn't exist yet**
   - The user explicitly said not to worry about this for now ("Azure AD Client ID這些不用，先用一般的帳號密碼
     登入就好") — real login (NextAuth credentials provider, bcrypt-hashed passwords, department-gated) is
     built and working; Entra ID SSO is deferred, not blocking anything currently in progress.
   - If picked back up later: the user (or their IT) needs to go to [portal.azure.com](https://portal.azure.com)
     → Microsoft Entra ID → App registrations → New registration, create a single-tenant SPA app, and get a
     **Client ID** and **Tenant ID** — the one step that genuinely needs their own Azure permissions.
   - Once that exists, this unblocks:
     - Wiring up NextAuth.js's Microsoft Entra ID provider (each person signs in with their own company
       Microsoft account) alongside (or instead of) the existing credentials provider.
     - Reading the user's `department` field to restrict login to 業務部 only (already implemented, just against
       manually-set `department` values rather than one synced from Microsoft Graph).
     - Calling the Microsoft Graph Calendar API for optional task/meeting → Outlook sync.

2. **Open questions from the original spec (`docs/PROJECT_SPEC.md` §9) still have no new answers**
   - 統包啟動會議 (kickoff meeting): currently kept at "one week before tender announcement" (`start - 7
     days`), confirmed by the user previously — but re-check if a real case doesn't match.
   - 工程事業簽呈 (engineering sign-off) timing: never given an exact rule, currently a placeholder "3 days
     before the pre-bid meeting" — actual company policy still pending.
   - Exact dates for owner-side processes (公開招標/決選廠商/施工評選簡報 etc.) are still reverse-engineered
     from experience-based ratios.

3. **PPTX export was deliberately not rebuilt** (the original spec explicitly says the user had it removed
   because running PptxGenJS in-browser caused crashes). If rebuilt later, the original spec recommends a real
   backend service or Claude Code's pptx skill — not a large library running in the browser.

## Current stack at a glance (details in `CLAUDE.md`)

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS v4 + Phosphor Icons
- **State management**: React Context (`AppContext`), fetches/saves through real API routes backed by Postgres
  — `localStorage` only holds a UI convenience (last-active case tab), no case data anymore
- **Database**: PostgreSQL 16, local via Docker Compose (`docker-compose.yml`, container `bid-scheduler-db`)
- **ORM**: Drizzle (`drizzle-orm` + `drizzle-kit` + `pg`) — switched from Prisma mid-project at the user's
  explicit request; see `DECISIONS.md` #12
- **Auth**: NextAuth (Auth.js) v5, Credentials provider (email/password, bcrypt-hashed), JWT sessions,
  department-gated (`業務部` only, admin accounts bypass this) — working end-to-end. Microsoft Entra ID SSO is
  still deferred (item 1 above), not currently blocking anything
- **Roles**: `users.role` (`"member" | "admin"`) — admin accounts get a separate `AdminShell` for member
  management (add/list/delete) and a cross-case project list; see `DECISIONS.md` #14 and `CLAUDE.md`'s
  "Admin role" section

## Suggested next steps, in order

1. If/when the user wants Microsoft Entra ID SSO, wire up NextAuth.js's Entra ID provider alongside the
   existing credentials provider, plus sync `department` from Microsoft Graph instead of setting it manually.
2. Once that's stable, build two-way Outlook sync (Microsoft Graph Calendar API) — the `syncToOutlook`/
   `outlookEventId` columns already exist on `tasks` for this.
3. Otherwise, no other work is currently blocked — case CRUD, auth, and admin/member-management are all live.

## The user's working-style preferences (for future me)

- **Communication language**: has switched between Chinese and English mid-project more than once (Chinese →
  English → back to Chinese, as of 2026-07-25) — treat whichever language the user's most recent message is in
  as the current preference for chat replies, and don't assume it's fixed. The product UI itself always stays
  Traditional Chinese regardless of chat language (real end users are Chinese-speaking staff at a Taiwan
  engineering firm) — this is a firm constraint, not tied to the chat-language toggle at all.
- When handing off large/multi-part work, prefers "finish everything, then notify once" — don't pop up with a
  progress report after every small step.
- For large UI-redesign tasks, expects a browser-screenshot verification loop before calling it done (now
  written into `CLAUDE.md`'s "Workflow: large UI/redesign tasks" section — follow it for similar future tasks).
- Basic due diligence on third-party resources (installing skills, downloading software) is expected — when
  the user linked a third-party skill, the right move was checking the GitHub repo, npm package contents, and
  for suspicious network calls before installing. Keep that habit.
