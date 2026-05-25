# Ripple Scout

Internal web tool for ingesting headerless YouTube creator CSVs from the
[Ripple Discover](../../Ripple%20Discover/) scraper, deduplicating channels,
and exploring them via filters, charts, and exports.

## Stack

- Next.js 15 App Router (TypeScript)
- Tailwind v4
- Prisma + PostgreSQL (local Docker, `postgres:16`)
- iron-session single-password auth
- papaparse for CSV in/out
- recharts for charts
- TanStack React Table for the channels table
- Vitest (pure-logic suite + a real-Postgres integration suite)

## Running locally

```bash
pnpm install
docker compose up -d   # start Postgres (postgres:16 on :5432)
pnpm db:migrate        # first-time: create the schema
pnpm dev
```

Then open <http://localhost:3000>.

## Configuration

Copy `.env.example` to `.env` and set:

```env
ADMIN_PASSWORD=your-shared-password
SESSION_SECRET=please-set-to-a-random-32-byte-hex-string
DATABASE_URL=postgresql://ripple:ripple@localhost:5432/ripple_scout?schema=public
```

The `DATABASE_URL` above matches the credentials in `docker-compose.yml`. For
Drive sync also set `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` and `GOOGLE_DRIVE_FOLDER_ID`.

Generate a session secret:

```bash
openssl rand -hex 32
```

## Data flow

1. **/upload** — drop one or more `.csv` files.
2. The server parses (headerless), normalizes, dedupes against the existing DB,
   and creates an `UploadBatch` in `previewing` status. The parsed rows are
   staged on disk in `uploads/<batchId>.json`.
3. **/batches/[id]/preview** — see what would be inserted vs updated, plus
   any parse errors. Click **Import** to commit.
4. **Import** (`commitBatch`) re-classifies against the current DB, then writes
   the whole batch in **one transaction**: new channels via `createMany`,
   existing ones via a single bulk `UPDATE` (non-empty merge of
   description/keywords/categories), and a `ChannelObservation` per row. It is
   **atomic** — if anything fails the whole batch rolls back and the batch is
   marked `failed`. Rows that fail to parse are recorded as `ImportError` at
   preview time and skipped.
5. **/dashboard** — KPIs and charts across the whole DB.
6. **/channels** — filterable / sortable / paginated table with CSV export.

## CSV column mapping

The CSV is headerless. Files come in two variants — 27 columns (no linktree
slot) and 28 columns (with linktree). The mapping lives in
`src/lib/csv/columns.ts` and normalization in `src/lib/csv/normalize.ts`.

Any other column count is rejected with a clear error and the file is not
imported.

## Resetting

Wipe imported data but keep the schema:

```bash
pnpm exec tsx scripts/clean.ts
```

Or drop the database entirely (removes the `ripple-pgdata` volume):

```bash
docker compose down -v
docker compose up -d && pnpm db:migrate
```
