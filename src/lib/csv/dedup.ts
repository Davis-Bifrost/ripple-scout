import type { NormalizedRow } from "./normalize";
import { prisma } from "../db";

export type DedupClassification = "new" | "update" | "intra_batch_duplicate";

export type ClassifiedRow = NormalizedRow & {
  classification: DedupClassification;
  existingId?: string;
};

/**
 * Pure classification: decide new/update/intra_batch_duplicate for each row
 * given a map of channelId → existing Channel row id already in the DB.
 *
 * Kept free of DB access so the decision matrix is unit-testable. `classifyRows`
 * is the thin DB-backed wrapper around it.
 * - "new"                    → not seen before
 * - "update"                 → channelId already exists in DB → will be merged
 * - "intra_batch_duplicate"  → appears more than once in this same CSV → only the first wins
 */
export function classifyAgainst(
  rows: NormalizedRow[],
  existingById: Map<string, string>,
): ClassifiedRow[] {
  const seenInBatch = new Set<string>();
  return rows.map((r) => {
    const existsInDb = existingById.has(r.channelId);
    const dupInBatch = seenInBatch.has(r.channelId);
    if (!dupInBatch) seenInBatch.add(r.channelId);

    if (dupInBatch) {
      return { ...r, classification: "intra_batch_duplicate" as const };
    }
    if (existsInDb) {
      return {
        ...r,
        classification: "update" as const,
        existingId: existingById.get(r.channelId),
      };
    }
    return { ...r, classification: "new" as const };
  });
}

/**
 * Classify rows against the current DB state.
 */
export async function classifyRows(rows: NormalizedRow[]): Promise<ClassifiedRow[]> {
  const ids = Array.from(new Set(rows.map((r) => r.channelId).filter(Boolean)));
  const existing = ids.length
    ? await prisma.channel.findMany({
        where: { channelId: { in: ids } },
        select: { id: true, channelId: true },
      })
    : [];
  const existingById = new Map(existing.map((e) => [e.channelId, e.id]));
  return classifyAgainst(rows, existingById);
}

export function summarizeClassification(rows: ClassifiedRow[]) {
  let newCount = 0;
  let updateCount = 0;
  let intraDup = 0;
  for (const r of rows) {
    if (r.classification === "new") newCount++;
    else if (r.classification === "update") updateCount++;
    else intraDup++;
  }
  return { newCount, updateCount, intraDup };
}
