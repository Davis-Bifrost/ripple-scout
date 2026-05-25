# Architecture

## Layers

```
app/(protected)/*/page.tsx      Server Components — fetch via lib/stats/* and prisma, render
app/(auth)/login                Login page + loginAction
app/actions/*.ts                'use server' mutations (auth, upload, drive, channels)
app/api/export/route.ts         The only API route — streams a CSV download
middleware.ts                   iron-session gate; redirects anon → /login
lib/csv/*                       The ingest pipeline (parse, columns, normalize, dedup, commit, storage, operator)
lib/drive.ts                    Google Drive client (memoized) + list/download
lib/drive-pipeline.ts           Windowed download→commit pipeline (parallel downloads, serial commits)
lib/stats/*                     Read-side aggregation (aggregate.ts = dashboard, market.ts = per-country)
lib/channels-query.ts           Zod-validated searchParams + Prisma where/orderBy builders
lib/session.ts                  iron-session config + helpers (getSession, isLoggedIn)
lib/db.ts                       PrismaClient singleton
lib/logger.ts                   pino logger + actionLogger(name)
prisma/schema.prisma            3 domain models + ImportError
```

Server-first: pages are async Server Components that call Prisma / `lib/stats` directly.
Client Components (`'use client'`) are limited to interactive bits (filter bar, dropzone,
charts, multi-select) and do not re-fetch — they push state into the URL and let the
server re-render.

## Data model

Four tables (`prisma/schema.prisma`):

- **UploadBatch** — one CSV upload. `status` lifecycle `previewing → committing → imported|failed`. `operator` (string, from filename), `fileHash` (SHA-256, dedup), `driveFileId` (Drive dedup), row counters.
- **Channel** — deduplicated creator, unique `channelId`. Current-state metadata; overwritten on re-import (non-null-only merge for description/keywords/categories). Denormalized `firstBatchId`/`lastBatchId`/`observationCount`.
- **ChannelObservation** — immutable per-(channel, batch) snapshot. The time-series. `onDelete: Restrict` from Channel, `Cascade` from UploadBatch.
- **ImportError** — per-row parse/normalize failures for a batch.

## Request flows

**Upload (manual):** `upload-dropzone` → `uploadCsv(formData)` → per file `uploadOne` (hash, dedup, parse, classify, create `previewing` batch, stage preview JSON to `uploads/`). If auto-import on, `commitBatch` runs immediately; otherwise the operator reviews `/batches/[id]/preview` and clicks commit.

**Upload (Drive):** `drive-import` → `syncDriveAction` / `importFromDriveAction` → downloads run concurrently in windows of 4 (`processFilesWindowed`, `lib/drive-pipeline.ts`) while commits stay serial → same `uploadOne` + `commitBatch` path, tagged with `driveFileId`. The Drive client + parsed key are memoized. Already-imported files are skipped by `driveFileId`; legacy untagged matches are backfilled.

**Commit:** `commitBatch(batchId)` — atomic status claim → load staged preview → re-classify against current DB → `commitClassifiedRows` runs the set-based write in **one transaction** (`createMany` new channels, one bulk `UPDATE … FROM (VALUES …)` for updates, `createMany` observations) → set `imported` → discard preview. On any error the whole batch rolls back: set `failed`, store message in `notes`. See `docs/CSV-PIPELINE.md`.

**Read (dashboard):** `dashboard/page.tsx` → `getDashboardStats()` (one `Promise.all` of ~17 queries). `force-dynamic`, no cache yet. See `docs/DASHBOARDS.md`.

**Read (channels):** `channels/page.tsx` → `parseSearchParams` (Zod) → `buildWhere`/`buildOrderBy` → paginated Prisma query. Export goes through `/api/export` → `exportChannelsCsv`.

## Adding a field end-to-end

To surface a new scraped column (e.g. a new contact field):

1. **`lib/csv/columns.ts`** — map the new cell index into `RawRow` (both 27- and 28-col branches). Bump the accepted column count if the CSV format changed.
2. **`lib/csv/normalize.ts`** — add the field to `NormalizedRow`, parse/clean it in `normalize()`.
3. **`prisma/schema.prisma`** — add the column to `Channel` (and `ChannelObservation` if it's time-varying). Run `pnpm db:migrate`.
4. **`src/lib/csv/commit.ts`** — add it to `newChannelData` (new-row insert) and the `columns` list in `buildBulkUpdate` (existing-row update), plus the observation payload if it's time-varying.
5. **`lib/csv/storage.ts`** — if the field is a `bigint`/`Date`, add it to the serialize/deserialize maps.
6. **Read side** — add to `select` in `aggregate.ts` / `channels/page.tsx` and render.
7. **Test** — add a case to `src/lib/csv/normalize.test.ts`.

## Database

Runs on **PostgreSQL** (local Docker, `postgres:16`) since the SQLite→PG migration.
- Concurrent writes are real (MVCC) — `commitBatch` calls no longer serialize behind a single write lock.
- Raw SQL in `lib/stats/*` and `channels/page.tsx` uses double-quoted mixed-case identifiers (`"Channel"`, `"channelRowId"`), real booleans (`"hasEmail" = true`), real timestamps (`to_char(...)`, no epoch math), and `percentile_cont` for median.
- `prisma migrate deploy` runs in CI against a `postgres:16` service container.

## Known constraints

- **`status` / `contactStatus` are still plain strings** constrained by code. Postgres enums are now available — converting them is an open follow-up.
- **Whole CSV buffered in memory** (60 MB cap) then chunked — no streaming.
- **`commitBatch` runs in the request lifecycle** — long imports block the tab. Background queue is a Phase 3 item.
- **No per-user identity** — single shared password; audit attribution is not possible yet.
