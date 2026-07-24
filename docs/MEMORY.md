# MEMORY.md — Project Context & Outstanding Items

> For anyone picking up this project cold (including future me). This holds "unresolved, will definitely be
> needed" items — not full technical docs (that's `CLAUDE.md`) or decision rationale (that's `DECISIONS.md`).

## Currently blocked / waiting on external input

1. **Microsoft Entra ID (Azure AD) App Registration doesn't exist yet**
   - The user (or their IT) needs to go to [portal.azure.com](https://portal.azure.com) → Microsoft Entra ID →
     App registrations → New registration, create a single-tenant SPA app, and get a **Client ID** and
     **Tenant ID**.
   - This is the one step I genuinely can't do on their behalf (needs their own Azure permissions).
   - Once that exists, this unblocks:
     - Wiring up NextAuth.js's Microsoft Entra ID provider (each person signs in with their own company
       Microsoft account).
     - Reading the user's `department` field to restrict login to 業務部 only.
     - Calling the Microsoft Graph Calendar API for optional task/meeting → Outlook sync.
   - Confirmed by the user: **each person logs in with their own Microsoft account** (not a shared account) —
     already reflected in the `users`/`accounts`/`sessions` table design (standard NextAuth multi-user adapter
     shape).

2. **Open questions from the original spec (`docs/PROJECT_SPEC.md` §9) still have no new answers**
   - 統包啟動會議 (kickoff meeting): currently kept at "one week before tender announcement" (`start - 7
     days`), confirmed by the user previously — but re-check if a real case doesn't match.
   - 工程事業簽呈 (engineering sign-off) timing: never given an exact rule, currently a placeholder "3 days
     before the pre-bid meeting" — actual company policy still pending.
   - Exact dates for owner-side processes (公開招標/決選廠商/施工評選簡報 etc.) are still reverse-engineered
     from experience-based ratios.

3. **Tender-document PDF auto-parsing not implemented**
   - The original approach (calling the Anthropic API directly from the frontend) would expose an API key in
     the browser — unsafe, deliberately not ported.
   - If rebuilt, needs a backend API route (Next.js Route Handler) to proxy the call, with the key kept server-
     side only — don't repeat the mistake of putting a key in frontend code.

4. **PPTX export was deliberately not rebuilt** (the original spec explicitly says the user had it removed
   because running PptxGenJS in-browser caused crashes). If rebuilt later, the original spec recommends a real
   backend service or Claude Code's pptx skill — not a large library running in the browser.

## Current stack at a glance (details in `CLAUDE.md`)

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS v4 + Phosphor Icons
- **State management**: still React Context + `localStorage` (not yet wired to the real backend API — the
  database is ready but the frontend hasn't been switched over)
- **Database**: PostgreSQL 16, local via Docker Compose (`docker-compose.yml`, container `bid-scheduler-db`)
- **ORM**: Prisma 7 (a very new major version — usage differs from most Prisma 5/6 tutorials online; see
  `DECISIONS.md` #3)
- **Auth**: schema is ready (standard NextAuth tables), but the actual NextAuth config and Microsoft Entra ID
  provider wiring haven't been written yet — blocked on item 1's Azure AD Client ID

## Suggested next steps, in order

1. Switch the frontend from localStorage to real API calls (Next.js Route Handlers + Prisma) — this doesn't
   need Azure AD and can be done now.
2. Once the user provides the Azure AD Client ID / Tenant ID, wire up NextAuth.js + the Microsoft Entra ID
   provider, plus the "業務部 only" login gate and "only the bid lead can edit their own case" permission
   checks.
3. Once permissions are stable, build two-way Outlook sync (Microsoft Graph Calendar API).

## The user's working-style preferences (for future me)

- **Communication language**: switched from Chinese back to **English** partway through this session (initial
  request was Chinese; user then said to use English going forward for chat and docs). The actual product UI
  stays in Traditional Chinese on purpose (real end users are Chinese-speaking staff at a Taiwan engineering
  firm) — this English-only preference is about *our* collaboration (chat, docs, commit messages), not the
  product's own UI copy or the verbatim-quoted `PROJECT_SPEC.md`.
- When handing off large/multi-part work, prefers "finish everything, then notify once" — don't pop up with a
  progress report after every small step.
- For large UI-redesign tasks, expects a browser-screenshot verification loop before calling it done (now
  written into `CLAUDE.md`'s "Workflow: large UI/redesign tasks" section — follow it for similar future tasks).
- Basic due diligence on third-party resources (installing skills, downloading software) is expected — when
  the user linked a third-party skill, the right move was checking the GitHub repo, npm package contents, and
  for suspicious network calls before installing. Keep that habit.
