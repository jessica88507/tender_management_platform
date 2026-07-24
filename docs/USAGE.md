# USAGE.md — Full Usage Guide

## 1. First-time setup (new environment)

```bash
# 1. Install dependencies
npm install

# 2. Start local PostgreSQL (needs Docker Desktop installed and running)
docker compose up -d

# 3. Copy the env template (.env is gitignored, create it yourself the first time)
cp .env.example .env

# 4. Apply the database schema
npx prisma migrate dev

# 5. (Optional) load sample data
npx prisma db seed

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 2. Day-to-day commands

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build (includes type-checking)
npm run start        # serve the production build
npm run lint         # ESLint
npx tsc --noEmit     # type-check only
```

## 3. Database commands

```bash
docker compose up -d          # start the PostgreSQL container
docker compose down            # stop the container (data stays in the volume)
docker compose down -v         # stop AND delete data (destructive — wipes the database)

npx prisma studio                       # open the DB GUI browser
npx prisma migrate dev --name <label>   # after editing schema.prisma, create + apply a new migration
npx prisma generate                     # regenerate the Prisma Client only (schema unchanged, no new migration)
npx prisma db seed                      # reload sample data
```

## 4. Project doc map

| File | Purpose |
|---|---|
| `CLAUDE.md` | Technical architecture + conventions, written for Claude Code but equally useful for human developers |
| `docs/PROJECT_SPEC.md` | The original functional spec (scheduling rules, data model, UI spec) — check here before changing any rule |
| `docs/DECISIONS.md` | Why each architecture/tech choice was made, including trade-offs |
| `docs/PROGRESS.md` | Reverse-chronological development log |
| `docs/MEMORY.md` | What's currently blocked/waiting on external input, next-step suggestions, working-style preferences |
| `docs/USAGE.md` | This file — operational how-to |

## 5. Standard process for large UI/redesign work

For any "broad redesign of pages/components" task, follow this flow (also written into `CLAUDE.md` for the AI
assistant to follow automatically):

1. Implement with Tailwind CSS utility classes (no large bespoke CSS classes; use an SVG icon library, not
   emoji).
2. Once implemented, use the browser tool to screenshot every major screen/state, fix any visual issues found,
   re-screenshot, and repeat until clean.
3. Only after everything passes screenshot verification, report the result to the user **once** — no
   incremental progress updates mid-task.

## 6. Account login (planned, not yet enabled)

The system is designed for login via the company's Microsoft account (Microsoft Entra ID), each person using
their own:

- Only users whose department field is 業務部 can sign in.
- Each case can only be edited by the 主投標手 (bid lead) set at creation (`bidLeadUserId`) — everyone else who
  is signed in gets read-only access.
- Not yet enabled (needs the company's Azure AD App Registration Client ID — see `docs/MEMORY.md` #1). Until
  enabled, the system remains the single-machine `localStorage` version, where anyone who opens it can edit any
  case.

## 7. Outlook sync (planned, not yet enabled)

The database already reserves `tasks.syncToOutlook` (opt-in flag) and `tasks.outlookEventId` (the corresponding
Outlook event ID) columns. Once Microsoft login is enabled, tasks/meetings can be optionally synced to the
user's own Outlook calendar.
