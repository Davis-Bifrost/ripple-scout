/**
 * Phase 1 of the SQLite → Postgres migration: dump every table to JSON.
 *
 * MUST run while the project is still on SQLite (schema provider = sqlite,
 * DATABASE_URL = file:...). After the provider switch the Prisma client can no
 * longer read the SQLite file.
 *
 * BigInt (viewCount) → string, DateTime → ISO string, so the JSON round-trips
 * losslessly. All `id`s and FK values are preserved verbatim.
 *
 * Run:  pnpm exec tsx scripts/export-sqlite.ts
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db.ts";

const OUT_DIR = path.join(process.cwd(), "prisma", "data", "export");

function replacer(_key: string, value: unknown) {
  if (typeof value === "bigint") return value.toString();
  return value;
}

async function dump<T>(name: string, rows: T[]) {
  await fs.writeFile(
    path.join(OUT_DIR, `${name}.json`),
    JSON.stringify(rows, replacer),
    "utf-8",
  );
  console.log(`  ${name.padEnd(20)} ${rows.length}`);
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  console.log("Exporting from SQLite →", OUT_DIR);

  // Dates come back as Date objects; JSON.stringify serializes them to ISO
  // strings automatically. BigInt handled by the replacer above.
  const [uploadBatch, channel, channelObservation, importError] =
    await Promise.all([
      prisma.uploadBatch.findMany(),
      prisma.channel.findMany(),
      prisma.channelObservation.findMany(),
      prisma.importError.findMany(),
    ]);

  await dump("uploadBatch", uploadBatch);
  await dump("channel", channel);
  await dump("channelObservation", channelObservation);
  await dump("importError", importError);

  // Write a manifest of counts for the import step to verify against.
  const counts = {
    uploadBatch: uploadBatch.length,
    channel: channel.length,
    channelObservation: channelObservation.length,
    importError: importError.length,
    exportedAt: new Date().toISOString(),
  };
  await fs.writeFile(
    path.join(OUT_DIR, "_manifest.json"),
    JSON.stringify(counts, null, 2),
    "utf-8",
  );

  console.log("\nManifest:", JSON.stringify(counts));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
