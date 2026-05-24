-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "operator" TEXT,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "driveFileId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "UploadBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "handle" TEXT,
    "channelUrl" TEXT,
    "subscriberCount" INTEGER,
    "videoCount" INTEGER,
    "viewCount" BIGINT,
    "engagementRate" DOUBLE PRECISION,
    "tierRaw" TEXT,
    "tierDerived" TEXT,
    "countryCode" TEXT,
    "joinedDate" TIMESTAMP(3),
    "email" TEXT,
    "emailSource" TEXT,
    "hasEmail" BOOLEAN NOT NULL DEFAULT false,
    "contactStatus" TEXT NOT NULL,
    "whatsapp" TEXT,
    "phone" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "tiktok" TEXT,
    "twitter" TEXT,
    "linktree" TEXT,
    "channelLinks" TEXT,
    "contactSummary" TEXT,
    "description" TEXT,
    "keywords" TEXT,
    "categories" TEXT,
    "searchKeyword" TEXT,
    "targetCountry" TEXT,
    "crawledAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "firstBatchId" TEXT NOT NULL,
    "lastBatchId" TEXT NOT NULL,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelObservation" (
    "id" TEXT NOT NULL,
    "channelRowId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "searchKeyword" TEXT,
    "targetCountry" TEXT,
    "crawledAt" TIMESTAMP(3),
    "subscriberCount" INTEGER,
    "viewCount" BIGINT,
    "engagementRate" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "rawRow" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadBatch_uploadedAt_idx" ON "UploadBatch"("uploadedAt");

-- CreateIndex
CREATE INDEX "UploadBatch_fileHash_idx" ON "UploadBatch"("fileHash");

-- CreateIndex
CREATE INDEX "UploadBatch_operator_idx" ON "UploadBatch"("operator");

-- CreateIndex
CREATE INDEX "UploadBatch_driveFileId_idx" ON "UploadBatch"("driveFileId");

-- CreateIndex
CREATE UNIQUE INDEX "Channel_channelId_key" ON "Channel"("channelId");

-- CreateIndex
CREATE INDEX "Channel_countryCode_idx" ON "Channel"("countryCode");

-- CreateIndex
CREATE INDEX "Channel_tierDerived_idx" ON "Channel"("tierDerived");

-- CreateIndex
CREATE INDEX "Channel_hasEmail_idx" ON "Channel"("hasEmail");

-- CreateIndex
CREATE INDEX "Channel_searchKeyword_idx" ON "Channel"("searchKeyword");

-- CreateIndex
CREATE INDEX "Channel_subscriberCount_idx" ON "Channel"("subscriberCount");

-- CreateIndex
CREATE INDEX "Channel_lastSeenAt_idx" ON "Channel"("lastSeenAt");

-- CreateIndex
CREATE INDEX "ChannelObservation_channelRowId_idx" ON "ChannelObservation"("channelRowId");

-- CreateIndex
CREATE INDEX "ChannelObservation_batchId_idx" ON "ChannelObservation"("batchId");

-- CreateIndex
CREATE INDEX "ChannelObservation_crawledAt_idx" ON "ChannelObservation"("crawledAt");

-- CreateIndex
CREATE INDEX "ImportError_batchId_idx" ON "ImportError"("batchId");

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_lastBatchId_fkey" FOREIGN KEY ("lastBatchId") REFERENCES "UploadBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelObservation" ADD CONSTRAINT "ChannelObservation_channelRowId_fkey" FOREIGN KEY ("channelRowId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelObservation" ADD CONSTRAINT "ChannelObservation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
