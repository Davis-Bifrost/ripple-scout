/**
 * Read-only smoke test for the Postgres-rewritten raw SQL. Calls the dashboard
 * and market aggregators and prints headline numbers so they can be compared
 * against the pre-migration SQLite values. Does NOT mutate anything.
 *
 * Run:  pnpm exec tsx scripts/verify-stats.ts
 */
import "dotenv/config";
import { getDashboardStats } from "../src/lib/stats/aggregate.ts";
import { getMarketStats, listKnownMarkets } from "../src/lib/stats/market.ts";
import { prisma } from "../src/lib/db.ts";

async function main() {
  console.log("=== Dashboard ===");
  const d = await getDashboardStats();
  console.log("totalChannels    :", d.totalChannels);
  console.log("totalObservations:", d.totalObservations);
  console.log("totalBatches     :", d.totalBatches);
  console.log("withEmail        :", d.withEmail);
  console.log("emailRate        :", d.emailRate.toFixed(2) + "%");
  console.log("avgSubscribers   :", d.avgSubscribers);
  console.log("medianSubscribers:", d.medianSubscribers);
  console.log("byCountry top3   :", d.byCountry.slice(0, 3).map((c) => `${c.key}:${c.count}`).join(" "));
  console.log("byTier           :", d.byTier.map((t) => `${t.key}:${t.count}`).join(" "));
  console.log("byCrawlDate (n)  :", d.byCrawlDate.length, "days; first:", d.byCrawlDate[0]);
  console.log("operators (n)    :", d.byOperator.length);
  console.log("top operator     :", d.byOperator[0] ? `${d.byOperator[0].operator} uniq=${d.byOperator[0].uniqueChannels} email=${d.byOperator[0].withEmail} lastUpload=${d.byOperator[0].lastUploadAt}` : "(none)");
  console.log("dailyOperator (n):", d.dailyOperator.length, "first:", d.dailyOperator[0]);
  console.log("keyword top1     :", d.keywordSummary[0]);
  console.log("topBySubs[0]     :", d.topBySubs[0] ? `${d.topBySubs[0].channelName} subs=${d.topBySubs[0].subscriberCount} views=${d.topBySubs[0].viewCount}` : "(none)");

  console.log("\n=== Markets ===");
  const markets = await listKnownMarkets();
  console.log("known markets    :", markets.length, markets.slice(0, 10).join(","));
  const m = await getMarketStats("MY", "either");
  console.log("MY/either total  :", m.totalChannels, "based:", m.basedHere, "targeting:", m.targetingHere);
  console.log("MY operators (n) :", m.byOperator.length);
  console.log("MY dailyOp (n)   :", m.dailyOperator.length);
  console.log("MY totalObs      :", m.totalObservations);

  await prisma.$disconnect();
  console.log("\nAll aggregators executed without error. ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
