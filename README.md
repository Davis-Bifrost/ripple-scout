# Ripple Scout

Internal web tool for ingesting headerless YouTube creator CSVs from the
[Ripple Discover](../../Ripple%20Discover/) scraper, deduplicating channels,
and exploring them via filters, charts, and exports.

## Stack

- Next.js 15 App Router (TypeScript)
- Tailwind v4
- Prisma + SQLite (single file under `data/ripple-scout.db`)
- iron-session single-password auth
- papaparse for CSV in/out
- recharts for charts
- TanStack React Table for the channels table

## Running locally

```bash
pnpm install
pnpm db:migrate
pnpm dev
```

Then open <http://localhost:3000>.

## Configuration

Copy `.env.example` to `.env` and set:

```env
ADMIN_PASSWORD=your-shared-password
SESSION_SECRET=please-set-to-a-random-32-byte-hex-string
DATABASE_URL=file:./data/ripple-scout.db
```

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
4. **Import** runs upserts in 200-row chunks within Prisma transactions. New
   rows create a `Channel`; existing rows update non-empty fields and always
   append a `ChannelObservation`. Per-row errors are isolated (logged to
   `ImportError`, batch keeps going).
5. **/dashboard** — KPIs and charts across the whole DB.
6. **/channels** — filterable / sortable / paginated table with CSV export.

## CSV column mapping

The CSV is headerless. Files come in two variants — 27 columns (no linktree
slot) and 28 columns (with linktree). The mapping lives in
`src/lib/csv/columns.ts` and normalization in `src/lib/csv/normalize.ts`.

Any other column count is rejected with a clear error and the file is not
imported.

## Resetting

```bash
rm data/ripple-scout.db
pnpm db:migrate
```
