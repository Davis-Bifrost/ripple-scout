-- AlterTable
ALTER TABLE "UploadBatch" ADD COLUMN "driveFileId" TEXT;

-- CreateIndex
CREATE INDEX "UploadBatch_driveFileId_idx" ON "UploadBatch"("driveFileId");
