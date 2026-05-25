# CSV ingest pipeline

Source files come from the external **Ripple Discover** scraper: headerless CSVs,
either **27 or 28 columns**. Any other column count is rejected per-row.

```
parseCsvText(text)            lib/csv/parse.ts      — PapaParse, headerless, greedy-skip-empty
  → mapRow(cells)             lib/csv/columns.ts    — positional → RawRow; rejects ≠ {27,28} cols
  → normalize(raw)            lib/csv/normalize.ts  — clean/parse/derive → NormalizedRow | reject
classifyRows(rows)            lib/csv/dedup.ts      — new | update | intra_batch_duplicate
commitBatch(batchId)          app/actions/upload.ts — orchestration (claim, status, revalidate)
  → commitClassifiedRows      lib/csv/commit.ts     — set-based write, one transaction
```

## Column map (`columns.ts`)

The **28-column** variant has `linktree` at slot 19; the **27-column** variant omits it
and every later field shifts down by one. Both map to the same `RawRow`.

| idx (28) | field | idx (27) |
|---|---|---|
| 0 | channelId | 0 |
| 1 | channelName | 1 |
| 2 | handle | 2 |
| 3 | channelUrl | 3 |
| 4 | subscriberCountRaw | 4 |
| 5 | videoCountRaw | 5 |
| 6 | viewCountRaw | 6 |
| 7 | engagementRateRaw | 7 |
| 8 | tierRaw | 8 |
| 9 | countryCodeRaw | 9 |
| 10 | joinedDateRaw | 10 |
| 11 | email | 11 |
| 12 | emailSource | 12 |
| 13 | whatsapp | 13 |
| 14 | phone | 14 |
| 15 | facebook | 15 |
| 16 | instagram | 16 |
| 17 | tiktok | 17 |
| 18 | twitter | 18 |
| 19 | **linktree** | _(absent)_ |
| 20 | channelLinks | 19 |
| 21 | contactSummary | 20 |
| 22 | description | 21 |
| 23 | keywords | 22 |
| 24 | categories | 23 |
| 25 | searchKeyword | 24 |
| 26 | targetCountry | 25 |
| 27 | crawledAtRaw | 26 |

## Normalization rules (`normalize.ts`)

**Rejection:** a row is rejected (recorded as an `ImportError`, not imported) if it has no
`channelId`. `channelName` falls back to `(unnamed)`.

**Numbers:** commas/spaces stripped. `subscriberCount`/`videoCount` → int; `viewCount` →
bigint; `engagementRate` → float. Non-finite → null.

**Dates:** accepts `YYYY-MM-DD` and `YYYY-MM-DD HH:MM:SS` (parsed as **UTC**), else falls
back to `new Date(str)`. Unparseable → null.

**Country:** uppercased; kept only if it matches `^[A-Z]{2}$`, else null. Applies to both
`countryCode` and `targetCountry`.

**Handles/socials:** leading `@` stripped from handle, instagram, tiktok, twitter, linktree.

**Noise filtering:** these tokens (case-insensitive) become null:
`"" · "no contact found" · "no email found" · "n/a" · "na" · "none" · "null" · "needs_manual" · "no_contact"`.

**`channelLinks`** — pipe-delimited (`a | b | c`) → JSON array string.
**`categories`** — comma-delimited → JSON array string.

**Email backfill:** if the `email` column is empty, try to regex-extract an email from
`description`. If found, `emailSource` becomes `"description_regex"`.

**Tier (`deriveTier`, from subscriberCount — NOT the scraped tier):**

| subs | tier |
|---|---|
| null / non-finite / ≤ 0 | Unknown |
| 1 – 999 | New |
| 1 000 – 9 999 | Nano |
| 10 000 – 99 999 | Micro |
| 100 000 – 499 999 | Mid-Tier |
| 500 000 – 999 999 | Macro |
| ≥ 1 000 000 | Mega |

(The scraped `tierRaw` is kept separately but the **derived** tier is what dashboards use.)

**Contact status (`deriveContactStatus`), in priority order:**

1. `has_email` — an email is present.
2. `needs_manual_check` — no email, but `emailSource` contains "manual".
3. `has_social_only` — no email, but some social/contact field is present.
4. `no_contact` — nothing.

## Deduplication (`dedup.ts`)

`classifyAgainst(rows, existingById)` (pure, unit-tested) decides per row:

- **new** — `channelId` not in the DB and not yet seen in this batch.
- **update** — `channelId` already exists in the DB (will be merged; first occurrence only).
- **intra_batch_duplicate** — `channelId` already appeared earlier in *this* CSV → skipped.

First occurrence always wins, even if the channel also exists in the DB (→ `update`, later
copies → `intra_batch_duplicate`). `classifyRows` is the DB-backed wrapper that loads
`existingById` then calls `classifyAgainst`.

## Commit (`commitBatch`)

1. **Atomic claim:** `updateMany({where: {id, status: "previewing"}, data: {status: "committing"}})`. If count = 0, abort (duplicate/again-state). This is the idempotency guard.
2. Load the staged preview JSON (`uploads/<batchId>.json`). Missing → fail the batch.
3. Persist parse-time `ImportError` rows.
4. **Re-classify** against current DB state (catches preview↔commit races).
5. **Set-based write** via `commitClassifiedRows` (`src/lib/csv/commit.ts`), all in **one transaction**: `new` → `createMany`; `update` → one bulk `UPDATE "Channel" … FROM (VALUES …)` (COALESCE merge of description/keywords/categories, `observationCount + 1`); then a single `createMany` for every observation. `intra_batch_duplicate` → skipped. Rows are chunked (500) to bound per-statement bind-params, but all chunks share the one transaction — they are not separate commits.
6. Set status `imported`, write counters, discard preview, revalidate paths.
7. On any error the whole transaction rolls back (no partial channels/observations persist): set status `failed`, store message in `notes`, return the error.

**Merge policy:** on `update`, scalar fields are overwritten with the new values; but
`description`/`keywords`/`categories` are only overwritten when the new value is non-null
(don't erase prior data with a blank re-scrape).

## Testing

`src/lib/csv/*.test.ts` cover `columns.mapRow`, all `normalize` rules, and the
`classifyAgainst` matrix — pure logic, no DB. Run `pnpm test:run`.

DB-backed behavior now has a real integration suite (`pnpm test:integration`,
`vitest.integration.config.ts`): `commit.integration.test.ts` exercises
`commitClassifiedRows` against the local Postgres — new/update, COALESCE merge,
`observationCount` increment, intra-batch-duplicate skip, and whole-batch rollback —
using synthetic prefixed ids that clean up after themselves. `scripts/verify-commit-idempotency.ts`
still proves the `previewing→committing` claim is atomic under concurrent callers.
