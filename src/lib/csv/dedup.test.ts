import { describe, it, expect } from "vitest";
import { classifyAgainst, summarizeClassification } from "./dedup";
import type { NormalizedRow } from "./normalize";

// Minimal NormalizedRow factory — only channelId matters for classification.
function r(channelId: string): NormalizedRow {
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
  };
}

describe("classifyAgainst", () => {
  it("marks unseen channels as new", () => {
    const out = classifyAgainst([r("A"), r("B")], new Map());
    expect(out.map((x) => x.classification)).toEqual(["new", "new"]);
  });

  it("marks channels already in the DB as update with existingId", () => {
    const out = classifyAgainst([r("A")], new Map([["A", "row-1"]]));
    expect(out[0].classification).toBe("update");
    expect(out[0].existingId).toBe("row-1");
  });

  it("marks the 2nd+ appearance within a batch as intra_batch_duplicate", () => {
    const out = classifyAgainst([r("A"), r("A"), r("A")], new Map());
    expect(out.map((x) => x.classification)).toEqual([
      "new",
      "intra_batch_duplicate",
      "intra_batch_duplicate",
    ]);
  });

  it("first occurrence wins even when channel also exists in DB", () => {
    const out = classifyAgainst([r("A"), r("A")], new Map([["A", "row-9"]]));
    expect(out.map((x) => x.classification)).toEqual([
      "update",
      "intra_batch_duplicate",
    ]);
  });

  it("handles a mixed batch", () => {
    const out = classifyAgainst(
      [r("new1"), r("exist1"), r("new1"), r("new2")],
      new Map([["exist1", "id-1"]]),
    );
    expect(out.map((x) => x.classification)).toEqual([
      "new",
      "update",
      "intra_batch_duplicate",
      "new",
    ]);
  });

  it("returns an empty array for no rows", () => {
    expect(classifyAgainst([], new Map())).toEqual([]);
  });
});

describe("summarizeClassification", () => {
  it("counts each classification bucket", () => {
    const out = classifyAgainst(
      [r("a"), r("b"), r("a"), r("c")],
      new Map([["b", "id-b"]]),
    );
    expect(summarizeClassification(out)).toEqual({
      newCount: 2, // a, c
      updateCount: 1, // b
      intraDup: 1, // second a
    });
  });
});
