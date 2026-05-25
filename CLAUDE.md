# Ripple Scout

Internal tool for ingesting, deduplicating, and exploring YouTube creator CSVs
produced by the external "Ripple Discover" scraper. Operators upload CSVs (drag-drop
or Google Drive sync); the app normalizes and deduplicates them into a channel store
with time-series observations, then renders operator/country/tier dashboards.

**Not** an HR / MLM / e-commerce system, despite any prior framing.

## Domain glossary

- **Channel** — a deduplicated YouTube creator, keyed by `channelId` (the YouTube UC… id). Current-state metadata (subs, contact info, tier) lives here and is overwritten on each re-import.
- **ChannelObservation** — one immutable snapshot of a channel per (channel, batch). The time-series. Never updated after insert.
- **UploadBatch** — one uploaded CSV file. Has a `status` lifecycle (see below) and an `operator`.
- **Operator** — the team member who produced a CSV, parsed from the filename (`ripple_<operator>_…`). Currently a free string, not an FK.
- **Tier** — derived from subscriber count (New / Nano / Micro / Mid-Tier / Macro / Mega). See `deriveTier`.

## Stack

Next.js 15 (App Router) · React 19 · Prisma 5 · **PostgreSQL** (local Docker; postgres:16) · iron-session · TanStack Table · Recharts · papaparse · googleapis · Tailwind v4 · pino · Vitest.

## Pipeline (the heart of the app)

```
CSV → parseCsvText → mapRow (27/28 cols) → normalize → classifyRows → commitBatch
                                                                          ↓
                                          Channel (upsert) + ChannelObservation (insert) + ImportError
```

See `docs/CSV-PIPELINE.md` for the column map and every normalization rule.

## Load-bearing invariants (don't break these)

- **`commitBatch` is idempotent** via an atomic `previewing → committing` claim (`updateMany` where status=previewing). A duplicate call finds count=0 and aborts. Status ends at `imported` or `failed`. See `src/app/actions/upload.ts`.
- **The commit is set-based and atomic.** Writes go through `commitClassifiedRows` (`src/lib/csv/commit.ts`): `createMany` for new channels, one bulk `UPDATE … FROM (VALUES …)` for existing ones (COALESCE on description/keywords/categories, `observationCount + 1`), and a `createMany` for observations — not a round-trip per row. The whole batch runs in **one transaction**, so any failure rolls back everything; a `failed` batch never leaves partial channels/observations behind.
- **Status lifecycle:** `previewing → committing → (imported | failed)`. Enforced by code; the column is still a plain string (converting to a Postgres enum is an open follow-up). Only `previewing`/`failed` batches may be discarded.
- **Classification re-runs at commit time** (not just at preview) to catch races between preview and commit.
- **`Channel.observationCount` is a hand-maintained counter.** Reconcile with `scripts/reconcile-observation-count.ts` if dashboard numbers look off.
- **Operator stats use CTEs to avoid grain double-counting** (batch→observation→channel is a fan-out). Don't write naive joins over these three tables. See `docs/DASHBOARDS.md`.
- **`onDelete`:** Channel→Observation is `Restrict` (never cascade-delete history). Batch→Observation is `Cascade` (discardBatch is the only delete path, gated to previewing/failed).
- **File dedup is by SHA-256** of file contents, not filename.

## Local development

Postgres runs in Docker — start it before anything DB-related:

```bash
docker compose up -d      # start Postgres (postgres:16 on :5432); run once per boot
pnpm db:migrate           # first-time: create schema (prisma migrate dev)
pnpm dev                  # Next dev server on :3000
pnpm db:studio            # Prisma Studio
pnpm typecheck            # tsc --noEmit
pnpm test                 # vitest (watch) — pure-logic suite, DB-free
pnpm test:run             # vitest run (CI mode) — pure-logic suite
pnpm test:integration     # vitest run against the real local Postgres
```

Two test suites: the default (`test`/`test:run`) is pure-logic and never connects
to a DB (a fake `DATABASE_URL` is injected). `test:integration` (`*.integration.test.ts`,
`vitest.integration.config.ts`) hits the real local Postgres — tests there use
uniquely-prefixed synthetic ids and clean up after themselves, so they never wipe
real data.

If the app can't reach the DB, check `docker compose ps` — the container must be
healthy. Stop it with `docker compose down` (data persists in the `ripple-pgdata` volume).

Required env (`.env`): `DATABASE_URL` (Postgres connection string), `ADMIN_PASSWORD`,
`SESSION_SECRET` (iron-session), and for Drive sync: `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`,
`GOOGLE_DRIVE_FOLDER_ID`. See `.env.example`.

Auth is a single shared password (`ADMIN_PASSWORD`), timing-safe compare + per-IP rate limit. No per-user identity yet.

## Useful scripts (`scripts/`, run with `pnpm exec tsx`)

- `reconcile-observation-count.ts [--fix]` — fix `observationCount` drift.
- `verify-commit-idempotency.ts` — prove the commit claim is atomic.
- `verify-search-params.ts` — prove Zod search-param parsing degrades safely.
- `verify.ts` — end-to-end pipeline run against sample CSVs (**wipes the DB**).
- `clean.ts` — wipe all imported data (**destructive**).

## Docs

- `docs/ARCHITECTURE.md` — layers, data flow, where to add a field end-to-end.
- `docs/CSV-PIPELINE.md` — column map, normalization rules, dedup matrix.
- `docs/DASHBOARDS.md` — every aggregate query and the business question it answers.

## Conventions

- Mutations are **server actions** (`src/app/actions/`). The one API route (`/api/export`) exists because it streams a file download.
- Validate untrusted input (searchParams, action args) with **Zod** — schemas live in `src/lib/channels-query.ts` and inline in actions.
- Log through `actionLogger(name)` from `src/lib/logger.ts` (pino). No PII in field names.
- On **PostgreSQL** since the SQLite→PG migration: real concurrent writes (MVCC), enums now available (status/contactStatus could be converted), `percentile_cont` for median. Raw SQL must use double-quoted mixed-case identifiers (`"Channel"`, `"channelRowId"`) and real booleans/timestamps.
