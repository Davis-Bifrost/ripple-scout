/**
 * Phase 2 of the SQLite → Postgres migration: load the JSON dumps from
 * scripts/export-sqlite.ts into the (now Postgres) database.
 *
 * Run AFTER: provider switched to postgresql, `prisma migrate dev` applied,
 * Postgres reachable. Insertion order respects FKs:
 *   UploadBatch → Channel → ChannelObservation → ImportError
 *
 * Deserializes viewCount (string → BigInt) and DateTime (ISO string → Date).
 * Preserves all primary keys and FK values. Asserts final counts match the
 * export manifest.
 *
 * Run:  pnpm exec tsx scripts/import-postgres.ts
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/lib/db.ts";

const DIR = path.join(process.cwd(), "prisma", "data", "export");
const CHUNK = 1000;

type FieldSpec = { dates: string[]; bigints: string[] };

const SPECS: Record<string, FieldSpec> = {
  uploadBatch: { dates: ["uploadedAt"], bigints: [] },
  channel: {
    dates: ["joinedDate", "crawledAt", "firstSeenAt", "lastSeenAt"],
    bigints: ["viewCount"],
  },
  channelObservation: {
    dates: ["crawledAt", "createdAt"],
    bigints: ["viewCount"],
  },
  importError: { dates: ["createdAt"], bigints: [] },
};

function revive(rows: Record<string, unknown>[], spec: FieldSpec) {
  for (const row of rows) {
    for (const f of spec.dates) {
      if (row[f] != null) row[f] = new Date(row[f] as string);
    }
    for (const f of spec.bigints) {
      if (row[f] != null) row[f] = BigInt(row[f] as string);
    }
  }
  return rows;
}

async function load(name: string): Promise<Record<string, unknown>[]> {
  const raw = await fs.readFile(path.join(DIR, `${name}.json`), "utf-8");
  return revive(JSON.parse(raw), SPECS[name]);
}

async function insertChunked(
  model: { createMany: (a: { data: Record<string, unknown>[] }) => Promise<{ count: number }> },
  rows: Record<string, unknown>[],
  label: string,
) {
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const res = await model.createMany({ data: chunk });
    done += res.count;
  }
  console.log(`  ${label.padEnd(20)} ${done}`);
  return done;
}

async function main() {
  const manifest = JSON.parse(
    await fs.readFile(path.join(DIR, "_manifest.json"), "utf-8"),
  ) as Record<string, number>;

  // Refuse to import into a non-empty DB (avoid duplicate/partial states).
  const existing = await prisma.uploadBatch.count();
  if (existing > 0) {
    throw new Error(
      `Target DB already has ${existing} batches — refusing to import. Run scripts/clean.ts first if this is intentional.`,
    );
  }

  console.log("Importing into Postgres (FK-safe order)…");
  const [batches, channels, observations, errors] = await Promise.all([
    load("uploadBatch"),
    load("channel"),
    load("channelObservation"),
    load("importError"),
  ]);

  await insertChunked(prisma.uploadBatch, batches, "uploadBatch");
  await insertChunked(prisma.channel, channels, "channel");
  await insertChunked(prisma.channelObservation, observations, "channelObservation");
  await insertChunked(prisma.importError, errors, "importError");

  // Verify against the export manifest.
  const finalCounts = {
    uploadBatch: await prisma.uploadBatch.count(),
    channel: await prisma.channel.count(),
    channelObservation: await prisma.channelObservation.count(),
    importError: await prisma.importError.count(),
  };

  console.log("\nFinal counts:", JSON.stringify(finalCounts));
  let ok = true;
  for (const k of Object.keys(finalCounts) as (keyof typeof finalCounts)[]) {
    if (finalCounts[k] !== manifest[k]) {
      console.error(
        `MISMATCH ${k}: imported ${finalCounts[k]} vs export ${manifest[k]}`,
      );
      ok = false;
    }
  }
  await prisma.$disconnect();
  if (!ok) process.exit(1);
  console.log("\nAll counts match the export manifest. ✓");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
