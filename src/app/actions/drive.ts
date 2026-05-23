"use server";

import { listCsvFiles, downloadFile, type DriveFile } from "@/lib/drive";
import { uploadOne, commitBatch } from "@/app/actions/upload";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { UploadResult } from "@/app/actions/upload";

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
    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to list Drive files" };
  }
}

export async function importFromDriveAction(
  fileIds: string[],
  fileNames: Record<string, string>,
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (const id of fileIds) {
    const name = fileNames[id] ?? `${id}.csv`;
    try {
      const buffer = await downloadFile(id);
      const file = new File([new Uint8Array(buffer)], name, { type: "text/csv" });
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
      results.push(res);
    } catch (err) {
      results.push({
        filename: name,
        ok: false,
        error: err instanceof Error ? err.message : "Download failed",
      });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/batches");
  revalidatePath("/channels");
  return results;
}

export async function syncDriveAction(): Promise<
  { ok: true; result: SyncResult } | { ok: false; error: string }
> {
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

    const imported: UploadResult[] = [];

    for (const f of newFiles) {
      try {
        const buffer = await downloadFile(f.id);
        const file = new File([new Uint8Array(buffer)], f.name, { type: "text/csv" });
        const res = await uploadOne(file, f.id);

        // File exists in DB but was imported before driveFileId tracking.
        // Backfill the tag so future syncs skip it without downloading.
        if (res.duplicateOfBatchId) {
          await prisma.uploadBatch.update({
            where: { id: res.duplicateOfBatchId },
            data: { driveFileId: f.id },
          });
          skippedCount++;
          skippedNames.push(f.name);
          continue;
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
        imported.push(res);
      } catch (err) {
        imported.push({
          filename: f.name,
          ok: false,
          error: err instanceof Error ? err.message : "Download failed",
        });
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/batches");
    revalidatePath("/channels");

    return {
      ok: true,
      result: { imported, skippedCount, skippedNames },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}
