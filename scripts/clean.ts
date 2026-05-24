/**
 * Wipe all imported data. Schema is preserved; restart is not required.
 *
 * Run:  pnpm exec tsx scripts/clean.ts
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db.ts";

async function main() {
  const before = await prisma.$transaction([
    prisma.importError.count(),
    prisma.channelObservation.count(),
    prisma.channel.count(),
    prisma.uploadBatch.count(),
  ]);
  console.log("Before:");
  console.log(`  ImportError       : ${before[0]}`);
  console.log(`  ChannelObservation: ${before[1]}`);
  console.log(`  Channel           : ${before[2]}`);
  console.log(`  UploadBatch       : ${before[3]}`);

  // Delete in FK-safe order. ImportError and ChannelObservation cascade from
  // UploadBatch + Channel, but Channel.lastBatchId is non-nullable with no
  // cascade, so Channel must come down before UploadBatch.
  await prisma.importError.deleteMany();
  await prisma.channelObservation.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.uploadBatch.deleteMany();

  // (Postgres autovacuums; no manual VACUUM needed.)

  const uploadDir = path.join(process.cwd(), "uploads");
  let removed = 0;
  try {
    const entries = await fs.readdir(uploadDir);
    for (const f of entries) {
      if (f.endsWith(".json")) {
        await fs.unlink(path.join(uploadDir, f));
        removed++;
      }
    }
  } catch {
    /* uploads dir may not exist */
  }
  console.log(`\nRemoved ${removed} staged preview JSON file(s).`);

  const after = await prisma.$transaction([
    prisma.importError.count(),
    prisma.channelObservation.count(),
    prisma.channel.count(),
    prisma.uploadBatch.count(),
  ]);
  console.log("\nAfter:");
  console.log(`  ImportError       : ${after[0]}`);
  console.log(`  ChannelObservation: ${after[1]}`);
  console.log(`  Channel           : ${after[2]}`);
  console.log(`  UploadBatch       : ${after[3]}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
