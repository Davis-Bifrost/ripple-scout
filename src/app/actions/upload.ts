"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { parseCsvText } from "@/lib/csv/parse";
import { classifyRows, summarizeClassification } from "@/lib/csv/dedup";
import { savePreview, loadPreview, discardPreview } from "@/lib/csv/storage";
import { extractOperator } from "@/lib/csv/operator";
import { revalidatePath } from "next/cache";

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

async function uploadOne(file: File): Promise<UploadResult> {
  const filename = file.name;
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
        status: "previewing",
        totalRows: parsed.totalRows,
        validRows: parsed.validRows.length,
        errorRows: parsed.problems.length,
        duplicateRows: summary.updateCount + summary.intraDup,
        importedRows: 0,
      },
    });

    await savePreview(batch.id, parsed.validRows, parsed.problems);

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
    return {
      filename,
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function commitBatch(batchId: string): Promise<{ ok: boolean; error?: string }> {
  const batch = await prisma.uploadBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { ok: false, error: "Batch not found" };
  if (batch.status !== "previewing") {
    return { ok: false, error: `Batch is in '${batch.status}' state` };
  }

  const preview = await loadPreview(batchId);
  if (!preview) {
    return { ok: false, error: "Preview data missing — please re-upload" };
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

  // Pre-classify against current DB state (snapshot inside the commit run too)
  const classified = await classifyRows(preview.rows);

  // Stats
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const CHUNK = 200;
  const now = new Date();

  for (let i = 0; i < classified.length; i += CHUNK) {
    const chunk = classified.slice(i, i + CHUNK);
    await prisma.$transaction(async (tx) => {
      for (const row of chunk) {
        if (row.classification === "intra_batch_duplicate") {
          skipped++;
          continue;
        }

        const channelData = {
          channelName: row.channelName,
          handle: row.handle,
          channelUrl: row.channelUrl,
          subscriberCount: row.subscriberCount,
          videoCount: row.videoCount,
          viewCount: row.viewCount,
          engagementRate: row.engagementRate,
          tierRaw: row.tierRaw,
          tierDerived: row.tierDerived,
          countryCode: row.countryCode,
          joinedDate: row.joinedDate,
          email: row.email,
          emailSource: row.emailSource,
          hasEmail: row.hasEmail,
          contactStatus: row.contactStatus,
          whatsapp: row.whatsapp,
          phone: row.phone,
          facebook: row.facebook,
          instagram: row.instagram,
          tiktok: row.tiktok,
          twitter: row.twitter,
          linktree: row.linktree,
          channelLinks: row.channelLinks,
          contactSummary: row.contactSummary,
          searchKeyword: row.searchKeyword,
          targetCountry: row.targetCountry,
          crawledAt: row.crawledAt,
          lastSeenAt: now,
          lastBatchId: batchId,
        };

        if (row.classification === "new") {
          const created = await tx.channel.create({
            data: {
              channelId: row.channelId,
              ...channelData,
              description: row.description,
              keywords: row.keywords,
              categories: row.categories,
              firstSeenAt: now,
              firstBatchId: batchId,
              observationCount: 1,
            },
          });
          await tx.channelObservation.create({
            data: {
              channelRowId: created.id,
              batchId,
              searchKeyword: row.searchKeyword,
              targetCountry: row.targetCountry,
              crawledAt: row.crawledAt,
              subscriberCount: row.subscriberCount,
              viewCount: row.viewCount,
              engagementRate: row.engagementRate,
            },
          });
          imported++;
        } else {
          // update — never overwrite text fields with empty new values
          const existing = await tx.channel.findUnique({
            where: { channelId: row.channelId },
            select: {
              id: true,
              description: true,
              keywords: true,
              categories: true,
              observationCount: true,
            },
          });
          if (!existing) {
            // Race: got classified as update but row is gone. Treat as new.
            const created = await tx.channel.create({
              data: {
                channelId: row.channelId,
                ...channelData,
                description: row.description,
                keywords: row.keywords,
                categories: row.categories,
                firstSeenAt: now,
                firstBatchId: batchId,
                observationCount: 1,
              },
            });
            await tx.channelObservation.create({
              data: {
                channelRowId: created.id,
                batchId,
                searchKeyword: row.searchKeyword,
                targetCountry: row.targetCountry,
                crawledAt: row.crawledAt,
                subscriberCount: row.subscriberCount,
                viewCount: row.viewCount,
                engagementRate: row.engagementRate,
              },
            });
            imported++;
            continue;
          }

          await tx.channel.update({
            where: { id: existing.id },
            data: {
              ...channelData,
              description: row.description ?? existing.description,
              keywords: row.keywords ?? existing.keywords,
              categories: row.categories ?? existing.categories,
              observationCount: existing.observationCount + 1,
            },
          });
          await tx.channelObservation.create({
            data: {
              channelRowId: existing.id,
              batchId,
              searchKeyword: row.searchKeyword,
              targetCountry: row.targetCountry,
              crawledAt: row.crawledAt,
              subscriberCount: row.subscriberCount,
              viewCount: row.viewCount,
              engagementRate: row.engagementRate,
            },
          });
          updated++;
        }
      }
    });
  }

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

  return { ok: true };
}

export async function discardBatch(batchId: string): Promise<void> {
  const batch = await prisma.uploadBatch.findUnique({ where: { id: batchId } });
  if (!batch) return;
  if (batch.status === "previewing") {
    await discardPreview(batchId);
    await prisma.uploadBatch.delete({ where: { id: batchId } });
  }
  revalidatePath("/batches");
  redirect("/upload");
}
