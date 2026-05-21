-- AlterTable
ALTER TABLE "UploadBatch" ADD COLUMN "operator" TEXT;

-- CreateIndex
CREATE INDEX "UploadBatch_operator_idx" ON "UploadBatch"("operator");
