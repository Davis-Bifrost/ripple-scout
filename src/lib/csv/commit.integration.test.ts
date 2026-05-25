import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { commitClassifiedRows } from "@/lib/csv/commit";
import type { ClassifiedRow, DedupClassification } from "@/lib/csv/dedup";
import type { NormalizedRow } from "@/lib/csv/normalize";

// Synthetic, run-unique channel ids so this never collides with or clobbers
// real data. afterAll deletes everything created under this prefix.
const PREFIX = `UCtest_${Date.now()}_`;
const ch = (n: string) => `${PREFIX}${n}`;

let batchA: string;
let batchB: string;

function baseRow(channelId: string, over: Partial<NormalizedRow> = {}): NormalizedRow {
  return {
    channelId,
    channelName: channelId,
    handle: null,
    channelUrl: null,
    subscriberCount: null,
    videoCount: null,
    viewCount: null,
    engagementRate: null,
    tierRaw: null,
    tierDerived: "Unknown",
    countryCode: null,
    joinedDate: null,
    email: null,
    emailSource: null,
    hasEmail: false,
    contactStatus: "no_contact",
    whatsapp: null,
    phone: null,
    facebook: null,
    instagram: null,
    tiktok: null,
    twitter: null,
    linktree: null,
    channelLinks: null,
    contactSummary: null,
    description: null,
    keywords: null,
    categories: null,
    searchKeyword: null,
    targetCountry: null,
    crawledAt: null,
    ...over,
  };
}

function row(
  classification: DedupClassification,
  channelId: string,
  over: Partial<NormalizedRow> = {},
  existingId?: string,
): ClassifiedRow {
  return { ...baseRow(channelId, over), classification, existingId };
}

async function makeBatch(tag: string): Promise<string> {
  const b = await prisma.uploadBatch.create({
    data: {
      filename: `${PREFIX}${tag}.csv`,
      fileSize: 0,
      fileHash: `${PREFIX}${tag}`,
      status: "imported",
    },
  });
  return b.id;
}

beforeAll(async () => {
  batchA = await makeBatch("A");
  batchB = await makeBatch("B");
});

afterAll(async () => {
  const channels = await prisma.channel.findMany({
    where: { channelId: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = channels.map((c) => c.id);
  if (ids.length) {
    await prisma.channelObservation.deleteMany({ where: { channelRowId: { in: ids } } });
    await prisma.channel.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.uploadBatch.deleteMany({ where: { id: { in: [batchA, batchB] } } });
  await prisma.$disconnect();
});

describe("commitClassifiedRows", () => {
  it("creates new channels with observationCount=1 and one observation each", async () => {
    const res = await commitClassifiedRows(
      [
        row("new", ch("new1"), { subscriberCount: 10, viewCount: 1000n }),
        row("new", ch("new2"), { subscriberCount: 20 }),
      ],
      batchA,
      new Date(),
    );

    expect(res).toEqual({ imported: 2, updated: 0, skipped: 0 });

    const c1 = await prisma.channel.findUnique({ where: { channelId: ch("new1") } });
    expect(c1?.observationCount).toBe(1);
    expect(c1?.subscriberCount).toBe(10);
    expect(c1?.viewCount).toBe(1000n);
    expect(c1?.firstBatchId).toBe(batchA);
    expect(c1?.lastBatchId).toBe(batchA);

    const obs = await prisma.channelObservation.count({
      where: { channelRowId: c1!.id },
    });
    expect(obs).toBe(1);
  });

  it("on update: overwrites scalars, COALESCEs description/keywords/categories, bumps count, adds observation", async () => {
    // Seed the channel via a first "new" commit.
    await commitClassifiedRows(
      [
        row("new", ch("upd"), {
          subscriberCount: 100,
          viewCount: 1000n,
          email: "old@example.com",
          hasEmail: true,
          description: "original description",
          keywords: "original keywords",
          categories: "original categories",
        }),
      ],
      batchA,
      new Date(),
    );

    // Re-import: scalars change, email cleared, description/categories absent
    // (null) so they must be preserved; keywords present so it overwrites.
    const res = await commitClassifiedRows(
      [
        row("update", ch("upd"), {
          subscriberCount: 200,
          viewCount: 2000n,
          email: null,
          hasEmail: false,
          description: null,
          keywords: "new keywords",
          categories: null,
          crawledAt: new Date("2026-01-15T00:00:00.000Z"),
        }),
      ],
      batchB,
      new Date(),
    );

    expect(res).toEqual({ imported: 0, updated: 1, skipped: 0 });

    const c = await prisma.channel.findUnique({ where: { channelId: ch("upd") } });
    expect(c?.subscriberCount).toBe(200); // overwritten
    expect(c?.viewCount).toBe(2000n); // overwritten (bigint)
    expect(c?.email).toBeNull(); // non-COALESCE field overwritten to null
    expect(c?.hasEmail).toBe(false); // boolean overwritten
    expect(c?.description).toBe("original description"); // COALESCE: kept
    expect(c?.categories).toBe("original categories"); // COALESCE: kept
    expect(c?.keywords).toBe("new keywords"); // present incoming overwrites
    expect(c?.crawledAt?.toISOString()).toBe("2026-01-15T00:00:00.000Z"); // timestamp cast
    expect(c?.observationCount).toBe(2); // incremented
    expect(c?.firstBatchId).toBe(batchA); // unchanged on update
    expect(c?.lastBatchId).toBe(batchB); // moved to latest

    const obs = await prisma.channelObservation.count({
      where: { channelRowId: c!.id },
    });
    expect(obs).toBe(2);
  });

  it("skips intra_batch_duplicate rows (no extra channel, observation, or count)", async () => {
    const res = await commitClassifiedRows(
      [
        row("new", ch("dup")),
        row("intra_batch_duplicate", ch("dup")),
      ],
      batchA,
      new Date(),
    );

    expect(res).toEqual({ imported: 1, updated: 0, skipped: 1 });

    const c = await prisma.channel.findUnique({ where: { channelId: ch("dup") } });
    expect(c?.observationCount).toBe(1);
    const obs = await prisma.channelObservation.count({
      where: { channelRowId: c!.id },
    });
    expect(obs).toBe(1);
  });

  it("handles a mixed new+update+duplicate batch in one call", async () => {
    await commitClassifiedRows([row("new", ch("mixExisting"))], batchA, new Date());

    const res = await commitClassifiedRows(
      [
        row("new", ch("mixNew")),
        row("update", ch("mixExisting"), { subscriberCount: 999 }),
        row("intra_batch_duplicate", ch("mixNew")),
      ],
      batchB,
      new Date(),
    );

    expect(res).toEqual({ imported: 1, updated: 1, skipped: 1 });
    const existing = await prisma.channel.findUnique({
      where: { channelId: ch("mixExisting") },
    });
    expect(existing?.subscriberCount).toBe(999);
    expect(existing?.observationCount).toBe(2);
  });

  it("is a no-op for an empty row set", async () => {
    const res = await commitClassifiedRows([], batchA, new Date());
    expect(res).toEqual({ imported: 0, updated: 0, skipped: 0 });
  });
});
