/**
 * Verifies that the atomic "claim" inside commitBatch can be entered by at
 * most one concurrent caller. This is the correctness foundation for
 * commitBatch idempotency: if the previewing→committing transition is atomic
 * under concurrent calls, duplicate commits cannot double-write observations.
 *
 * The script creates synthetic UploadBatch rows (no real channels are
 * touched), races N concurrent updateMany claims against each, asserts
 * exactly one wins, and cleans up.
 *
 * Run:  pnpm exec tsx scripts/verify-commit-idempotency.ts
 *
 * NOTE: This is a stand-in for a real Vitest test. When a test framework
 * lands (Phase 2 of the review roadmap), promote these assertions to a
 * proper integration test.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db.ts";

const BATCHES = 5;
const CONCURRENT_CLAIMS = 10;

async function claimOnce(batchId: string): Promise<boolean> {
  const res = await prisma.uploadBatch.updateMany({
    where: { id: batchId, status: "previewing" },
    data: { status: "committing" },
  });
  return res.count === 1;
}

async function main() {
  // Create the test batches up front so cleanup can always find them.
  const createdIds: string[] = [];
  for (let i = 0; i < BATCHES; i++) {
    const b = await prisma.uploadBatch.create({
      data: {
        filename: `__verify_idempotency_${i}_${Date.now()}.csv`,
        fileSize: 0,
        fileHash: `verify-${Date.now()}-${i}`,
        status: "previewing",
      },
    });
    createdIds.push(b.id);
  }

  let pass = 0;
  let fail = 0;

  try {
    for (const batchId of createdIds) {
      const winners = await Promise.all(
        Array.from({ length: CONCURRENT_CLAIMS }, () => claimOnce(batchId)),
      );
      const winCount = winners.filter(Boolean).length;
      const after = await prisma.uploadBatch.findUniqueOrThrow({
        where: { id: batchId },
        select: { status: true },
      });

      const ok = winCount === 1 && after.status === "committing";
      console.log(
        `batch=${batchId.slice(0, 8)}…  winners=${winCount}/${CONCURRENT_CLAIMS}  final=${after.status}  ${ok ? "PASS" : "FAIL"}`,
      );
      if (ok) pass++;
      else fail++;
    }
  } finally {
    for (const id of createdIds) {
      await prisma.uploadBatch.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log(`\n${pass}/${BATCHES} batches passed.`);
  if (fail > 0) {
    console.error(`${fail} FAIL — idempotency guard is broken.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
