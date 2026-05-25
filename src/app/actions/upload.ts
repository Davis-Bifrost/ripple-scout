"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseCsvText } from "@/lib/csv/parse";
import { classifyRows, summarizeClassification } from "@/lib/csv/dedup";
import { commitClassifiedRows } from "@/lib/csv/commit";
import { savePreview, loadPreview, discardPreview } from "@/lib/csv/storage";
import { extractOperator } from "@/lib/csv/operator";
import { revalidatePath } from "next/cache";
import { actionLogger } from "@/lib/logger";
import { z } from "zod";

const log = actionLogger("upload");

const batchIdSchema = z.string().min(1).max(60);

const MAX_BYTES = 60 * 1024 * 1024; // 60 MB

export type UploadResult = {
  filename: string;
  ok: boolean;
  batchId?: string;
  status?: string;
  totalRows?: number;
  validRows?: number;
  newCount?: number;
  updateCount?: number;
  intraDup?: number;
  errorRows?: number;
  duplicateOfBatchId?: string;
  imported?: boolean;
  error?: string;
};

export async function uploadCsv(formData: FormData): Promise<UploadResult[]> {
  const files = formData.getAll("files");
  const autoImport = formData.get("autoImport") !== "false";
  const results: UploadResult[] = [];

  for (const f of files) {
    if (!(f instanceof File)) continue;
    const res = await uploadOne(f);
    if (res.ok && res.batchId && autoImport) {
      const commit = await commitBatch(res.batchId);
      if (commit.ok) {
        res.status = "imported";
        res.imported = true;
      } else {
        res.error = `Auto-import failed: ${commit.error}`;
      }
    }
    results.push(res);
  }
  revalidatePath("/batches");
  revalidatePath("/dashboard");
  revalidatePath("/channels");
  return results;
}

export async function uploadOne(file: File, driveFileId?: string): Promise<UploadResult> {
  const filename = file.name;
  const t0 = Date.now();
  log.info({ filename, sizeKb: Math.round(file.size / 1024), driveFileId }, "upload_one_start");
  try {
    if (!filename.toLowerCase().endsWith(".csv")) {
      return { filename, ok: false, error: "Not a .csv file" };
    }
    if (file.size > MAX_BYTES) {
      return {
        filename,
        ok: false,
        error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB > 60MB)`,
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const existing = await prisma.uploadBatch.findFirst({
      where: { fileHash, status: { in: ["imported", "previewing"] } },
      orderBy: { uploadedAt: "desc" },
    });
    if (existing) {
      return {
        filename,
        ok: false,
        duplicateOfBatchId: existing.id,
        error: `Identical file already uploaded (batch ${existing.id})`,
      };
    }

    const text = buffer.toString("utf-8");
    const parsed = parseCsvText(text);
    const classified = await classifyRows(parsed.validRows);
    const summary = summarizeClassification(classified);

    const batch = await prisma.uploadBatch.create({
      data: {
        filename,
        operator: extractOperator(filename),
        fileSize: file.size,
        fileHash,
        driveFileId: driveFileId ?? null,
        status: "previewing",
        totalRows: parsed.totalRows,
        validRows: parsed.validRows.length,
        errorRows: parsed.problems.length,
        duplicateRows: summary.updateCount + summary.intraDup,
        importedRows: 0,
      },
    });

    await savePreview(batch.id, parsed.validRows, parsed.problems);

    log.info(
      {
        filename,
        batchId: batch.id,
        totalRows: parsed.totalRows,
        validRows: parsed.validRows.length,
        errorRows: parsed.problems.length,
        durationMs: Date.now() - t0,
      },
      "upload_one_ok",
    );

    return {
      filename,
      ok: true,
      batchId: batch.id,
      status: batch.status,
      totalRows: parsed.totalRows,
      validRows: parsed.validRows.length,
      newCount: summary.newCount,
      updateCount: summary.updateCount,
      intraDup: summary.intraDup,
      errorRows: parsed.problems.length,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error";
    log.error({ filename, error, durationMs: Date.now() - t0 }, "upload_one_failed");
    return { filename, ok: false, error };
  }
}

export async function commitBatch(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const t0 = Date.now();
  const idParse = batchIdSchema.safeParse(batchId);
  if (!idParse.success) {
    return { ok: false, error: "Invalid batchId" };
  }
  batchId = idParse.data;
  // Atomic claim: only one caller may transition previewing → committing.
  // A duplicate call (double-click, retried action, two tabs) finds count=0
  // and aborts before any observations are written.
  const claim = await prisma.uploadBatch.updateMany({
    where: { id: batchId, status: "previewing" },
    data: { status: "committing" },
  });
  if (claim.count === 0) {
    const existing = await prisma.uploadBatch.findUnique({
      where: { id: batchId },
      select: { status: true },
    });
    if (!existing) {
      log.warn({ batchId }, "commit_batch_not_found");
      return { ok: false, error: "Batch not found" };
    }
    log.warn({ batchId, status: existing.status }, "commit_batch_claim_blocked");
    return {
      ok: false,
      error: `Cannot commit batch in '${existing.status}' state`,
    };
  }
  log.info({ batchId }, "commit_batch_start");

  // From here on, any thrown error must transition status to "failed" so the
  // batch is not stuck in "committing" forever and a retry isn't blocked.
  try {
    const preview = await loadPreview(batchId);
    if (!preview) {
      throw new Error("Preview data missing — discard this batch and re-upload");
    }

    // Persist parse-time problems
    if (preview.problems.length) {
      await prisma.importError.createMany({
        data: preview.problems.map((p) => ({
          batchId,
          rowNumber: p.rowNumber,
          reason: p.reason,
          rawRow: p.rawRow,
        })),
      });
    }

    // Re-classify against current DB state. This re-runs at commit time (not
    // just at preview) to catch races between preview and commit.
    const classified = await classifyRows(preview.rows);

    // Set-based commit: one createMany + one bulk UPDATE + one observation
    // createMany per chunk, instead of a round-trip per row. See
    // `commitClassifiedRows`.
    const now = new Date();
    const { imported, updated, skipped } = await commitClassifiedRows(
      classified,
      batchId,
      now,
    );

    await prisma.uploadBatch.update({
      where: { id: batchId },
      data: {
        status: "imported",
        importedRows: imported + updated,
        duplicateRows: updated + skipped,
        validRows: imported + updated + skipped,
      },
    });

    await discardPreview(batchId);

    revalidatePath("/dashboard");
    revalidatePath("/channels");
    revalidatePath("/batches");
    revalidatePath(`/batches/${batchId}`);

    log.info(
      { batchId, imported, updated, skipped, durationMs: Date.now() - t0 },
      "commit_batch_ok",
    );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log.error({ batchId, error: msg, durationMs: Date.now() - t0 }, "commit_batch_failed");
    // Best-effort: mark the batch failed so it isn't stuck in 'committing'
    // and the operator can discard + re-upload.
    await prisma.uploadBatch
      .update({
        where: { id: batchId },
        data: { status: "failed", notes: msg.slice(0, 1000) },
      })
      .catch(() => {});
    revalidatePath("/batches");
    revalidatePath(`/batches/${batchId}`);
    return { ok: false, error: msg };
  }
}

export async function discardBatch(batchId: string): Promise<void> {
  const idParse = batchIdSchema.safeParse(batchId);
  if (!idParse.success) return;
  batchId = idParse.data;
  const batch = await prisma.uploadBatch.findUnique({ where: { id: batchId } });
  if (!batch) return;
  // 'previewing' and 'failed' batches can be discarded; 'committing' must
  // never be discarded (a commit may still be in flight) and 'imported'
  // batches require an explicit destructive purge, not a discard.
  if (batch.status === "previewing" || batch.status === "failed") {
    await discardPreview(batchId);
    await prisma.uploadBatch.delete({ where: { id: batchId } });
    log.info({ batchId, fromStatus: batch.status }, "discard_batch_ok");
  } else {
    log.warn({ batchId, status: batch.status }, "discard_batch_refused");
  }
  revalidatePath("/batches");
  redirect("/upload");
}
