import "dotenv/config";
import { prisma } from "../src/lib/db.ts";
import { deriveTier } from "../src/lib/csv/normalize.ts";

async function main() {
  const rows = await prisma.channel.findMany({
    select: { id: true, subscriberCount: true, tierDerived: true },
  });

  const counts: Record<string, number> = {};
  const updates: { id: string; tier: string }[] = [];

  for (const r of rows) {
    const next = deriveTier(r.subscriberCount);
    counts[next] = (counts[next] ?? 0) + 1;
    if (next !== r.tierDerived) updates.push({ id: r.id, tier: next });
  }

  console.log("Target distribution:");
  for (const [k, v] of Object.entries(counts).sort()) {
    console.log(`  ${k.padEnd(10)} ${v}`);
  }

  console.log(`\nUpdates needed: ${updates.length}`);
  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    await prisma.$transaction(
      slice.map((u) =>
        prisma.channel.update({
          where: { id: u.id },
          data: { tierDerived: u.tier },
        }),
      ),
    );
  }
  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
