-- CreateTable
CREATE TABLE "UploadBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "channelName" TEXT NOT NULL,
    "handle" TEXT,
    "channelUrl" TEXT,
    "subscriberCount" INTEGER,
    "videoCount" INTEGER,
    "viewCount" BIGINT,
    "engagementRate" REAL,
    "tierRaw" TEXT,
    "tierDerived" TEXT,
    "countryCode" TEXT,
    "joinedDate" DATETIME,
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
    "crawledAt" DATETIME,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observationCount" INTEGER NOT NULL DEFAULT 1,
    "firstBatchId" TEXT NOT NULL,
    "lastBatchId" TEXT NOT NULL,
    CONSTRAINT "Channel_lastBatchId_fkey" FOREIGN KEY ("lastBatchId") REFERENCES "UploadBatch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChannelObservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelRowId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "searchKeyword" TEXT,
    "targetCountry" TEXT,
    "crawledAt" DATETIME,
    "subscriberCount" INTEGER,
    "viewCount" BIGINT,
    "engagementRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelObservation_channelRowId_fkey" FOREIGN KEY ("channelRowId") REFERENCES "Channel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChannelObservation_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "rawRow" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportError_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "UploadBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UploadBatch_uploadedAt_idx" ON "UploadBatch"("uploadedAt");

-- CreateIndex
CREATE INDEX "UploadBatch_fileHash_idx" ON "UploadBatch"("fileHash");

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
