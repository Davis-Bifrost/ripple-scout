import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import type { ClassifiedRow } from "./dedup";

export type CommitCounts = {
  imported: number;
  updated: number;
  skipped: number;
};

// Bounds the per-statement parameter count (Postgres caps bind params at 65535).
// At ~33 columns per update row that is ~2k rows; 500 keeps us comfortably under
// and bounds transaction size.
const CHUNK = 500;
const TX_TIMEOUT_MS = 30_000;
const TX_MAX_WAIT_MS = 10_000;

// Fields that are only overwritten when the incoming value is non-null, so a
// sparse re-import never erases prose we already have. Mirrors the old
// per-row `row.x ?? existing.x` logic via SQL COALESCE.
const COALESCE_FIELDS = new Set(["description", "keywords", "categories"]);

/**
 * Set-based commit of classified rows for one batch.
 *
 * Replaces the old per-row create/update loop (one round-trip per row) with a
 * handful of statements per chunk:
 *   1. `createMany` for new channels (Prisma generates the cuid ids)
 *   2. a single `UPDATE … FROM (VALUES …)` for existing channels, with COALESCE
 *      on the prose fields and `observationCount + 1`
 *   3. `createMany` for every observation in the chunk
 *
 * Intra-batch duplicates are skipped (only the first occurrence wins, decided
 * upstream in `classifyRows`). Counts are derived from classification, matching
 * the previous behavior. Idempotency is still guaranteed by the
 * previewing→committing claim in `commitBatch`, not here.
 */
export async function commitClassifiedRows(
  rows: ClassifiedRow[],
  batchId: string,
  now: Date,
): Promise<CommitCounts> {
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const news = chunk.filter((r) => r.classification === "new");
    const updates = chunk.filter((r) => r.classification === "update");
    skipped += chunk.filter(
      (r) => r.classification === "intra_batch_duplicate",
    ).length;

    if (news.length === 0 && updates.length === 0) continue;

    await prisma.$transaction(
      async (tx) => {
        if (news.length) {
          await tx.channel.createMany({
            data: news.map((r) => newChannelData(r, batchId, now)),
          });
        }

        if (updates.length) {
          await tx.$executeRaw(buildBulkUpdate(updates, batchId, now));
        }

        // Resolve row ids for every channel we just wrote, to attach
        // observations. New rows have no id until now (createMany doesn't
        // return them); update rows carry existingId, but a single lookup
        // covers both uniformly.
        const touched = [...news, ...updates];
        const channelRows = await tx.channel.findMany({
          where: { channelId: { in: touched.map((r) => r.channelId) } },
          select: { id: true, channelId: true },
        });
        const idByChannelId = new Map(
          channelRows.map((c) => [c.channelId, c.id]),
        );

        const observations = touched.flatMap((r) => {
          const channelRowId = idByChannelId.get(r.channelId);
          if (!channelRowId) return [];
          return [
            {
              channelRowId,
              batchId,
              searchKeyword: r.searchKeyword,
              targetCountry: r.targetCountry,
              crawledAt: r.crawledAt,
              subscriberCount: r.subscriberCount,
              viewCount: r.viewCount,
              engagementRate: r.engagementRate,
            },
          ];
        });
        if (observations.length) {
          await tx.channelObservation.createMany({ data: observations });
        }

        imported += news.length;
        updated += updates.length;
      },
      { timeout: TX_TIMEOUT_MS, maxWait: TX_MAX_WAIT_MS },
    );
  }

  return { imported, updated, skipped };
}

function newChannelData(r: ClassifiedRow, batchId: string, now: Date) {
  return {
    channelId: r.channelId,
    channelName: r.channelName,
    handle: r.handle,
    channelUrl: r.channelUrl,
    subscriberCount: r.subscriberCount,
    videoCount: r.videoCount,
    viewCount: r.viewCount,
    engagementRate: r.engagementRate,
    tierRaw: r.tierRaw,
    tierDerived: r.tierDerived,
    countryCode: r.countryCode,
    joinedDate: r.joinedDate,
    email: r.email,
    emailSource: r.emailSource,
    hasEmail: r.hasEmail,
    contactStatus: r.contactStatus,
    whatsapp: r.whatsapp,
    phone: r.phone,
    facebook: r.facebook,
    instagram: r.instagram,
    tiktok: r.tiktok,
    twitter: r.twitter,
    linktree: r.linktree,
    channelLinks: r.channelLinks,
    contactSummary: r.contactSummary,
    description: r.description,
    keywords: r.keywords,
    categories: r.categories,
    searchKeyword: r.searchKeyword,
    targetCountry: r.targetCountry,
    crawledAt: r.crawledAt,
    firstSeenAt: now,
    lastSeenAt: now,
    firstBatchId: batchId,
    lastBatchId: batchId,
    observationCount: 1,
  };
}

/**
 * Build a single `UPDATE "Channel" … FROM (VALUES …)` for all update rows.
 *
 * Each value is cast to its column type inline so the VALUES column types are
 * unambiguous regardless of nulls or row order. `firstSeenAt`/`firstBatchId`
 * are deliberately not in the SET list — first-seen provenance never changes.
 */
function buildBulkUpdate(
  updates: ClassifiedRow[],
  batchId: string,
  now: Date,
): Prisma.Sql {
  // [columnName, pgCast, value extractor]; channelId is the join key, not a SET target.
  const columns: [string, string, (r: ClassifiedRow) => unknown][] = [
    ["channelId", "text", (r) => r.channelId],
    ["channelName", "text", (r) => r.channelName],
    ["handle", "text", (r) => r.handle],
    ["channelUrl", "text", (r) => r.channelUrl],
    ["subscriberCount", "integer", (r) => r.subscriberCount],
    ["videoCount", "integer", (r) => r.videoCount],
    ["viewCount", "bigint", (r) => r.viewCount],
    ["engagementRate", "double precision", (r) => r.engagementRate],
    ["tierRaw", "text", (r) => r.tierRaw],
    ["tierDerived", "text", (r) => r.tierDerived],
    ["countryCode", "text", (r) => r.countryCode],
    ["joinedDate", "timestamp", (r) => r.joinedDate],
    ["email", "text", (r) => r.email],
    ["emailSource", "text", (r) => r.emailSource],
    ["hasEmail", "boolean", (r) => r.hasEmail],
    ["contactStatus", "text", (r) => r.contactStatus],
    ["whatsapp", "text", (r) => r.whatsapp],
    ["phone", "text", (r) => r.phone],
    ["facebook", "text", (r) => r.facebook],
    ["instagram", "text", (r) => r.instagram],
    ["tiktok", "text", (r) => r.tiktok],
    ["twitter", "text", (r) => r.twitter],
    ["linktree", "text", (r) => r.linktree],
    ["channelLinks", "text", (r) => r.channelLinks],
    ["contactSummary", "text", (r) => r.contactSummary],
    ["description", "text", (r) => r.description],
    ["keywords", "text", (r) => r.keywords],
    ["categories", "text", (r) => r.categories],
    ["searchKeyword", "text", (r) => r.searchKeyword],
    ["targetCountry", "text", (r) => r.targetCountry],
    ["crawledAt", "timestamp", (r) => r.crawledAt],
    ["lastSeenAt", "timestamp", () => now],
    ["lastBatchId", "text", () => batchId],
  ];

  const valueRows = updates.map(
    (r) =>
      Prisma.sql`(${Prisma.join(
        columns.map(
          ([, cast, get]) => Prisma.sql`${get(r)}${Prisma.raw(`::${cast}`)}`,
        ),
      )})`,
  );

  const colNameList = columns.map(([name]) => `"${name}"`).join(", ");

  const setClause =
    columns
      .filter(([name]) => name !== "channelId")
      .map(([name]) =>
        COALESCE_FIELDS.has(name)
          ? `"${name}" = COALESCE(v."${name}", c."${name}")`
          : `"${name}" = v."${name}"`,
      )
      .join(", ") + `, "observationCount" = c."observationCount" + 1`;

  return Prisma.sql`
    UPDATE "Channel" AS c
    SET ${Prisma.raw(setClause)}
    FROM (VALUES ${Prisma.join(valueRows)}) AS v(${Prisma.raw(colNameList)})
    WHERE c."channelId" = v."channelId"
  `;
}
