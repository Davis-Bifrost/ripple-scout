/**
 * Reconcile Channel.observationCount against COUNT(observations).
 *
 * The counter is hand-maintained by commitBatch (`{increment: 1}`). With the
 * idempotency guard in place, going forward it should stay correct — but
 * any drift from prior duplicate commits or partial failures still needs to
 * be cleaned up. Run this any time the dashboard numbers look off.
 *
 * Run:
 *   pnpm exec tsx scripts/reconcile-observation-count.ts          # dry run
 *   pnpm exec tsx scripts/reconcile-observation-count.ts --fix    # apply
 */
import "dotenv/config";
import { prisma } from "../src/lib/db.ts";

async function main() {
  const fix = process.argv.includes("--fix");

  const channels = await prisma.channel.findMany({
    select: {
      id: true,
      channelId: true,
      observationCount: true,
      _count: { select: { observations: true } },
    },
  });

  const drifted = channels.filter(
    (c) => c.observationCount !== c._count.observations,
  );

  console.log(`Scanned ${channels.length} channels`);
  console.log(`Drifted : ${drifted.length}`);

  if (drifted.length === 0) {
    console.log("All counts in sync.");
    await prisma.$disconnect();
    return;
  }

  console.log(
    `\nDrift report (showing ${Math.min(drifted.length, 20)} of ${drifted.length}):`,
  );
  console.log(
    `  ${"channelId".padEnd(28)}  stored  actual  delta`,
  );
  for (const c of drifted.slice(0, 20)) {
    const delta = c._count.observations - c.observationCount;
    const sign = delta > 0 ? "+" : "";
    console.log(
      `  ${c.channelId.padEnd(28)}  ${String(c.observationCount).padStart(6)}  ${String(c._count.observations).padStart(6)}  ${sign}${delta}`,
    );
  }

  if (!fix) {
    console.log("\nDry run. Re-run with --fix to apply.");
    await prisma.$disconnect();
    return;
  }

  let updated = 0;
  for (const c of drifted) {
    await prisma.channel.update({
      where: { id: c.id },
      data: { observationCount: c._count.observations },
    });
    updated++;
  }
  console.log(`\nFixed ${updated} row(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
