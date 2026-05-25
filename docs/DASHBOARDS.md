# Dashboards & aggregation queries

Two read-side modules. Both run on every request (`force-dynamic`, no cache yet).

- `lib/stats/aggregate.ts` → `getDashboardStats()` — the global `/dashboard`.
- `lib/stats/market.ts` → `getMarketStats(code, scope)` — per-country `/markets/[code]`.

## The grain trap (read this before touching these queries)

`UploadBatch` → `ChannelObservation` → `Channel` is a **fan-out**: one batch has many
observations, one channel has many observations. A naive
`JOIN … GROUP BY operator` over all three multiplies counts (an operator's channel count
gets inflated by its observation count). This was a real shipped bug (commit "Fix operator
stat double-counting").

The fix, used in `aggregate.ts`'s operator query, is to separate the grains into CTEs and
only join after de-duplicating:

- `batch_counts` — batch-grain (imported vs preview counts, last upload) from `UploadBatch` alone.
- `obs_counts` — observation-grain count.
- `operator_channels` — `SELECT DISTINCT operator, channelRowId` (collapses the fan-out).
- `channel_stats` — aggregates (uniqueChannels, withEmail, avgSubs, MY count) over the *distinct* set.

**Rule:** never count channels by joining straight through observations. Distinct first.

## `getDashboardStats()` — query inventory

One `Promise.all`. Each entry and the question it answers:

| Result | Source | Business question |
|---|---|---|
| `totalChannels` | `channel.count` | How many unique creators do we have? |
| `totalObservations` | `channelObservation.count` | How many crawl snapshots total? |
| `totalBatches` | `uploadBatch.count(status=imported)` | How many CSVs successfully imported? |
| `withEmail` / `needsManualCheck` | `channel.count` (filtered) | Outreach readiness: how many are contactable / need a human? |
| `avgSubscribers` | `channel.aggregate _avg` | Average reach. |
| `medianSubscribers` | raw SQL `ORDER BY … LIMIT 1 OFFSET count/2` | Median reach (avg is skewed by mega creators). **Full table scan — slow at scale.** |
| `byCountry` (top 15) | `groupBy countryCode` | Where are creators based? |
| `byTier` | `groupBy tierDerived` (sorted New→Mega) | Reach distribution. |
| `byContactStatus` | `groupBy contactStatus` | Contactability split. |
| `byCrawlDate` (90d) | raw SQL on `crawledAt` | Crawl volume over time. |
| `topBySubs` / `topByViews` (50) | `findMany orderBy` | Leaderboards. |
| `keywordSummary` (50) | raw SQL `GROUP BY searchKeyword` | Which search terms surface the most / best creators? |
| `countryTier` | raw SQL `GROUP BY country, tier` | Country × tier heat data. |
| `byOperator` | **the CTE query above** | Operator leaderboard — batches, unique channels, email rate, MY count, last upload. |
| `dailyOperator` | raw SQL `GROUP BY day, operator` | Per-operator daily activity (uses `COUNT(DISTINCT …)` to stay correct across the fan-out). |

Note: raw-SQL `COUNT`/`SUM` come back as `bigint`/string and are wrapped in `Number(...)`.
`crawledAt`/`uploadedAt` are ms epochs stored as integers — converted with
`datetime(col/1000,'unixepoch')` then `strftime`.

## `getMarketStats(code, scope)` — per-country view

`scope` selects the `where`:

- **based** — `countryCode = code` (creators who live in the market).
- **targeting** — `targetCountry = code` (crawls that *targeted* the market, regardless of creator home).
- **either** — `countryCode = code OR targetCountry = code`.

Most slices reuse the Prisma `where`. Two raw-SQL queries (operator totals, daily operator)
inline the scope predicate via `Prisma.sql` fragments and use `COUNT(DISTINCT …)` to avoid
the grain trap. `byCountryOverlap` (only meaningful in targeting/either) shows the home
countries of creators crawled while targeting this market. `listKnownMarkets()` is the
`UNION` of all distinct `countryCode` and `targetCountry` values, for the market switcher.

## Performance notes

- All queries are uncached and `force-dynamic`. The dashboard fires ~17 queries per load.
  Phase 2 plan: `unstable_cache` keyed by filters, invalidated from `commitBatch`.
- The median query is a full scan with `OFFSET`. Fine at tens of thousands of rows; revisit
  with a window function (or Postgres `percentile_cont`) if it grows.
- Indexes backing these: `Channel(countryCode, tierDerived, hasEmail, searchKeyword, subscriberCount, lastSeenAt)`, `ChannelObservation(channelRowId, batchId, crawledAt)`, `UploadBatch(operator, uploadedAt, …)`. Composite indexes for the common filter pairs are a Phase 2 item.
