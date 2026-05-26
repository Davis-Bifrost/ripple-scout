/**
 * Reset `failed` UploadBatches back to `previewing` so they can be re-committed
 * without re-downloading the CSV.
 *
 * Only batches whose preview JSON is still on disk (`uploads/<id>.json`) are
 * eligible — those are the ones commitBatch can replay. A failed batch with no
 * preview file must be discarded and re-uploaded instead.
 *
 * Motivating case: commits aborted with "unexpected end of hex escape" from
 * lone UTF-16 surrogates in importError rows. The pipeline now sanitizes those
 * (see toWellFormedText), so a reset + re-commit succeeds.
 *
 * Run:
 *   pnpm exec tsx scripts/reset-failed-batches.ts          # dry run
 *   pnpm exec tsx scripts/reset-failed-batches.ts --fix    # apply
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/db.ts";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

async function main() {
  const fix = process.argv.includes("--fix");

  const failed = await prisma.uploadBatch.findMany({
    where: { status: "failed" },
    select: { id: true, filename: true, notes: true },
    orderBy: { uploadedAt: "asc" },
  });

  const recoverable = failed.filter((b) =>
    fs.existsSync(path.join(UPLOAD_DIR, `${b.id}.json`)),
  );
  const orphaned = failed.filter(
    (b) => !fs.existsSync(path.join(UPLOAD_DIR, `${b.id}.json`)),
  );

  console.log(`Failed batches      : ${failed.length}`);
  console.log(`  with preview file : ${recoverable.length} (resettable)`);
  console.log(`  no preview file   : ${orphaned.length} (must re-upload)`);

  if (recoverable.length) {
    console.log("\nResettable:");
    for (const b of recoverable) {
      const note = (b.notes ?? "").split("\n").filter(Boolean).pop() ?? "";
      console.log(`  ${b.id}  ${b.filename}  — ${note.slice(0, 80)}`);
    }
  }

  if (!fix) {
    console.log("\nDry run. Re-run with --fix to reset these to 'previewing'.");
    await prisma.$disconnect();
    return;
  }

  let reset = 0;
  for (const b of recoverable) {
    // Guard against a concurrent commit: only flip rows still 'failed'.
    const res = await prisma.uploadBatch.updateMany({
      where: { id: b.id, status: "failed" },
      data: { status: "previewing", notes: null },
    });
    reset += res.count;
  }
  console.log(`\nReset ${reset} batch(es) to 'previewing'.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
