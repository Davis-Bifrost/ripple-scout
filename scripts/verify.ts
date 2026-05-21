/* End-to-end verification of the CSV import pipeline.
 *
 * - Reads all sample CSVs from /Users/davis/Documents/Ripple Discover/Data/
 * - Parses + normalizes + classifies them
 * - Imports them via the same code paths that the Server Action uses (minus
 *   the HTTP layer)
 * - Then runs the dashboard aggregator and prints a summary
 *
 * Run with:  pnpm exec tsx scripts/verify.ts
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "../src/lib/db.ts";
import { parseCsvText } from "../src/lib/csv/parse.ts";
import { classifyRows, summarizeClassification } from "../src/lib/csv/dedup.ts";
import { getDashboardStats } from "../src/lib/stats/aggregate.ts";

const DATA_DIR = "/Users/davis/Documents/Ripple Discover/Data";

async function main() {
  console.log("Resetting DB state…");
  await prisma.importError.deleteMany();
  await prisma.channelObservation.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.uploadBatch.deleteMany();

  const entries = await fs.readdir(DATA_DIR);
  const csvs = entries
    .filter((e) => e.endsWith(".csv"))
    .map((e) => path.join(DATA_DIR, e))
    .sort();

  console.log(`Found ${csvs.length} CSV files:`);
  for (const p of csvs) console.log("  -", path.basename(p));

  for (const fp of csvs) {
    const text = await fs.readFile(fp, "utf-8");
    const fileHash = crypto.createHash("sha256").update(text).digest("hex");
    const parsed = parseCsvText(text);
    const classified = await classifyRows(parsed.validRows);
    const summary = summarizeClassification(classified);

    const batch = await prisma.uploadBatch.create({
      data: {
        filename: path.basename(fp),
        fileSize: text.length,
        fileHash,
        status: "previewing",
        totalRows: parsed.totalRows,
        validRows: parsed.validRows.length,
        errorRows: parsed.problems.length,
        duplicateRows: summary.updateCount + summary.intraDup,
      },
    });

    console.log(
      `\n${path.basename(fp)}: total=${parsed.totalRows} valid=${parsed.validRows.length} new=${summary.newCount} update=${summary.updateCount} intraDup=${summary.intraDup} errors=${parsed.problems.length}`,
    );
    if (parsed.problems.length) {
      for (const p of parsed.problems.slice(0, 5)) {
        console.log(`   ! row ${p.rowNumber}: ${p.reason}`);
      }
    }

    if (parsed.problems.length) {
      await prisma.importError.createMany({
        data: parsed.problems.map((p) => ({
          batchId: batch.id,
          rowNumber: p.rowNumber,
          reason: p.reason,
          rawRow: p.rawRow,
        })),
      });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const now = new Date();
    const CHUNK = 200;
    for (let i = 0; i < classified.length; i += CHUNK) {
      const chunk = classified.slice(i, i + CHUNK);
      await prisma.$transaction(async (tx) => {
        for (const row of chunk) {
          if (row.classification === "intra_batch_duplicate") {
            skipped++;
            continue;
          }
          const channelData = {
            channelName: row.channelName,
            handle: row.handle,
            channelUrl: row.channelUrl,
            subscriberCount: row.subscriberCount,
            videoCount: row.videoCount,
            viewCount: row.viewCount,
            engagementRate: row.engagementRate,
            tierRaw: row.tierRaw,
            tierDerived: row.tierDerived,
            countryCode: row.countryCode,
            joinedDate: row.joinedDate,
            email: row.email,
            emailSource: row.emailSource,
            hasEmail: row.hasEmail,
            contactStatus: row.contactStatus,
            whatsapp: row.whatsapp,
            phone: row.phone,
            facebook: row.facebook,
            instagram: row.instagram,
            tiktok: row.tiktok,
            twitter: row.twitter,
            linktree: row.linktree,
            channelLinks: row.channelLinks,
            contactSummary: row.contactSummary,
            searchKeyword: row.searchKeyword,
            targetCountry: row.targetCountry,
            crawledAt: row.crawledAt,
            lastSeenAt: now,
            lastBatchId: batch.id,
          };
          if (row.classification === "new") {
            const created = await tx.channel.create({
              data: {
                channelId: row.channelId,
                ...channelData,
                description: row.description,
                keywords: row.keywords,
                categories: row.categories,
                firstSeenAt: now,
                firstBatchId: batch.id,
                observationCount: 1,
              },
            });
            await tx.channelObservation.create({
              data: {
                channelRowId: created.id,
                batchId: batch.id,
                searchKeyword: row.searchKeyword,
                targetCountry: row.targetCountry,
                crawledAt: row.crawledAt,
                subscriberCount: row.subscriberCount,
                viewCount: row.viewCount,
                engagementRate: row.engagementRate,
              },
            });
            imported++;
          } else {
            const existing = await tx.channel.findUnique({
              where: { channelId: row.channelId },
              select: { id: true, description: true, keywords: true, categories: true, observationCount: true },
            });
            if (!existing) continue;
            await tx.channel.update({
              where: { id: existing.id },
              data: {
                ...channelData,
                description: row.description ?? existing.description,
                keywords: row.keywords ?? existing.keywords,
                categories: row.categories ?? existing.categories,
                observationCount: existing.observationCount + 1,
              },
            });
            await tx.channelObservation.create({
              data: {
                channelRowId: existing.id,
                batchId: batch.id,
                searchKeyword: row.searchKeyword,
                targetCountry: row.targetCountry,
                crawledAt: row.crawledAt,
                subscriberCount: row.subscriberCount,
                viewCount: row.viewCount,
                engagementRate: row.engagementRate,
              },
            });
            updated++;
          }
        }
      });
    }
    await prisma.uploadBatch.update({
      where: { id: batch.id },
      data: {
        status: "imported",
        importedRows: imported + updated,
        duplicateRows: updated + skipped,
        validRows: imported + updated + skipped,
      },
    });
    console.log(`  → imported=${imported} updated=${updated} skipped=${skipped}`);
  }

  console.log("\n=== Dashboard aggregates ===");
  const stats = await getDashboardStats();
  console.log("Total unique channels   :", stats.totalChannels);
  console.log("Total observations      :", stats.totalObservations);
  console.log("Total batches imported  :", stats.totalBatches);
  console.log("Channels with email     :", stats.withEmail);
  console.log("Channels needing manual :", stats.needsManualCheck);
  console.log("Email rate              :", stats.emailRate.toFixed(2) + "%");
  console.log("Avg subscribers         :", stats.avgSubscribers);
  console.log("Median subscribers      :", stats.medianSubscribers);
  console.log("\nBy country (top 10):");
  for (const c of stats.byCountry.slice(0, 10)) {
    console.log(`  ${c.key.padEnd(6)} ${c.count}`);
  }
  console.log("\nBy tier:");
  for (const t of stats.byTier) {
    console.log(`  ${t.key.padEnd(10)} ${t.count}`);
  }
  console.log("\nBy contact status:");
  for (const c of stats.byContactStatus) {
    console.log(`  ${c.key.padEnd(20)} ${c.count}`);
  }
  console.log("\nObservations by crawl date:");
  for (const d of stats.byCrawlDate) {
    console.log(`  ${d.date}  ${d.count}`);
  }
  console.log("\nTop 5 by subscribers:");
  for (const r of stats.topBySubs.slice(0, 5)) {
    console.log(
      `  ${(r.channelName || "?").padEnd(30)} ${r.countryCode ?? "—"}  subs=${r.subscriberCount}  views=${r.viewCount}`,
    );
  }
  console.log("\nTop 5 keywords:");
  for (const k of stats.keywordSummary.slice(0, 5)) {
    console.log(
      `  ${k.keyword.padEnd(25)} channels=${k.channelCount}  withEmail=${k.withEmail}  avgSubs=${k.avgSubscribers}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
