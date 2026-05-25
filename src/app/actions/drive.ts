"use server";

import { listCsvFiles, downloadFile, type DriveFile } from "@/lib/drive";
import { uploadOne, commitBatch } from "@/app/actions/upload";
import { prisma } from "@/lib/db";
import { processFilesWindowed } from "@/lib/drive-pipeline";
import { revalidatePath } from "next/cache";
import { actionLogger } from "@/lib/logger";
import { z } from "zod";
import type { UploadResult } from "@/app/actions/upload";

const log = actionLogger("drive");

// Downloads run concurrently in windows of this size; commits stay serial
// (they can race on shared channel ids across batches). See processFilesWindowed.
const DOWNLOAD_CONCURRENCY = 4;

const driveFileIdSchema = z.string().min(1).max(200);
const importInputSchema = z.object({
  fileIds: z.array(driveFileIdSchema).min(1).max(500),
  fileNames: z.record(z.string().min(1).max(200), z.string().min(1).max(500)),
});

export type { DriveFile };

export type SyncResult = {
  imported: UploadResult[];
  skippedCount: number;
  skippedNames: string[];
};

export async function listDriveFilesAction(): Promise<
  { ok: true; files: DriveFile[] } | { ok: false; error: string }
> {
  try {
    const files = await listCsvFiles();
    log.info({ count: files.length }, "drive_list_ok");
    return { ok: true, files };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Failed to list Drive files";
    log.error({ error }, "drive_list_failed");
    return { ok: false, error };
  }
}

export async function importFromDriveAction(
  fileIds: string[],
  fileNames: Record<string, string>,
): Promise<UploadResult[]> {
  const parsed = importInputSchema.safeParse({ fileIds, fileNames });
  if (!parsed.success) {
    log.warn({ issue: parsed.error.issues[0]?.message }, "drive_import_invalid_input");
    return [
      {
        filename: "",
        ok: false,
        error: "Invalid input to importFromDriveAction",
      },
    ];
  }
  const nameOf = (id: string) => parsed.data.fileNames[id] ?? `${id}.csv`;

  const results = await processFilesWindowed(parsed.data.fileIds, DOWNLOAD_CONCURRENCY, {
    download: (id) => downloadFile(id),
    commit: async (id, buffer) => {
      const file = new File([new Uint8Array(buffer)], nameOf(id), { type: "text/csv" });
      const res = await uploadOne(file, id);
      if (res.ok && res.batchId) {
        const commit = await commitBatch(res.batchId);
        if (commit.ok) {
          res.status = "imported";
          res.imported = true;
        } else {
          res.error = `Import failed: ${commit.error}`;
        }
      }
      return res;
    },
    onError: (id, error) => ({
      filename: nameOf(id),
      ok: false,
      error: error instanceof Error ? error.message : "Download failed",
    }),
  });

  revalidatePath("/dashboard");
  revalidatePath("/batches");
  revalidatePath("/channels");
  return results;
}

export async function syncDriveAction(): Promise<
  { ok: true; result: SyncResult } | { ok: false; error: string }
> {
  const t0 = Date.now();
  log.info("drive_sync_start");
  try {
    const driveFiles = await listCsvFiles();

    if (driveFiles.length === 0) {
      return { ok: true, result: { imported: [], skippedCount: 0, skippedNames: [] } };
    }

    // Find which Drive file IDs are already imported
    const alreadyImported = await prisma.uploadBatch.findMany({
      where: {
        driveFileId: { in: driveFiles.map((f) => f.id) },
        status: "imported",
      },
      select: { driveFileId: true },
    });
    const importedIds = new Set(alreadyImported.map((b) => b.driveFileId!));

    const newFiles = driveFiles.filter((f) => !importedIds.has(f.id));
    const skipped = driveFiles.filter((f) => importedIds.has(f.id));
    const skippedNames = skipped.map((f) => f.name);
    let skippedCount = skipped.length;

    // Download new files concurrently (windowed), commit them serially.
    type SyncOutcome =
      | { kind: "imported"; res: UploadResult }
      | { kind: "skipped"; name: string };

    const outcomes = await processFilesWindowed<DriveFile, SyncOutcome>(
      newFiles,
      DOWNLOAD_CONCURRENCY,
      {
        download: (f) => downloadFile(f.id),
        commit: async (f, buffer) => {
          const file = new File([new Uint8Array(buffer)], f.name, { type: "text/csv" });
          const res = await uploadOne(file, f.id);

          // File exists in DB but was imported before driveFileId tracking.
          // Backfill the tag so future syncs skip it without downloading.
          if (res.duplicateOfBatchId) {
            await prisma.uploadBatch.update({
              where: { id: res.duplicateOfBatchId },
              data: { driveFileId: f.id },
            });
            return { kind: "skipped", name: f.name };
          }

          if (res.ok && res.batchId) {
            const commit = await commitBatch(res.batchId);
            if (commit.ok) {
              res.status = "imported";
              res.imported = true;
            } else {
              res.error = `Import failed: ${commit.error}`;
            }
          }
          return { kind: "imported", res };
        },
        onError: (f, error) => ({
          kind: "imported",
          res: {
            filename: f.name,
            ok: false,
            error: error instanceof Error ? error.message : "Download failed",
          },
        }),
      },
    );

    const imported: UploadResult[] = [];
    for (const o of outcomes) {
      if (o.kind === "skipped") {
        skippedCount++;
        skippedNames.push(o.name);
      } else {
        imported.push(o.res);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/batches");
    revalidatePath("/channels");

    log.info(
      {
        importedCount: imported.length,
        importedOkCount: imported.filter((r) => r.ok && r.imported).length,
        skippedCount,
        durationMs: Date.now() - t0,
      },
      "drive_sync_ok",
    );
    return {
      ok: true,
      result: { imported, skippedCount, skippedNames },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Sync failed";
    log.error({ error, durationMs: Date.now() - t0 }, "drive_sync_failed");
    return { ok: false, error };
  }
}
