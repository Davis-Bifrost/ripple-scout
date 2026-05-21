import "dotenv/config";
import { prisma } from "../src/lib/db.ts";
import { extractOperator } from "../src/lib/csv/operator.ts";

async function main() {
  const batches = await prisma.uploadBatch.findMany({
    select: { id: true, filename: true, operator: true },
  });
  let updated = 0;
  let skipped = 0;
  for (const b of batches) {
    const op = extractOperator(b.filename);
    if (op === b.operator) {
      skipped++;
      continue;
    }
    await prisma.uploadBatch.update({
      where: { id: b.id },
      data: { operator: op },
    });
    console.log(`  ${b.filename} → ${op ?? "(none)"}`);
    updated++;
  }
  console.log(`\nDone. updated=${updated} unchanged=${skipped}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
