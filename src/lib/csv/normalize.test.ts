import { describe, it, expect } from "vitest";
import {
  deriveTier,
  deriveContactStatus,
  extractEmailFromText,
  normalize,
} from "./normalize";
import { mapRow } from "./columns";

describe("deriveTier", () => {
  it.each([
    [null, "Unknown"],
    [-5, "Unknown"],
    [0, "Unknown"],
    [1, "New"],
    [999, "New"],
    [1_000, "Nano"],
    [9_999, "Nano"],
    [10_000, "Micro"],
    [99_999, "Micro"],
    [100_000, "Mid-Tier"],
    [499_999, "Mid-Tier"],
    [500_000, "Macro"],
    [999_999, "Macro"],
    [1_000_000, "Mega"],
    [50_000_000, "Mega"],
  ])("subs=%s → %s", (subs, expected) => {
    expect(deriveTier(subs as number | null)).toBe(expected);
  });

  it("treats non-finite values as Unknown", () => {
    expect(deriveTier(NaN)).toBe("Unknown");
    expect(deriveTier(Infinity)).toBe("Unknown"); // non-finite guard runs first
  });
});

describe("deriveContactStatus", () => {
  it("email beats everything", () => {
    expect(
      deriveContactStatus({ hasEmail: true, hasSocial: true, emailSource: "manual" }),
    ).toBe("has_email");
  });
  it("manual email source → needs_manual_check", () => {
    expect(
      deriveContactStatus({ hasEmail: false, hasSocial: false, emailSource: "Manual review" }),
    ).toBe("needs_manual_check");
  });
  it("social without email → has_social_only", () => {
    expect(
      deriveContactStatus({ hasEmail: false, hasSocial: true, emailSource: null }),
    ).toBe("has_social_only");
  });
  it("nothing → no_contact", () => {
    expect(
      deriveContactStatus({ hasEmail: false, hasSocial: false, emailSource: null }),
    ).toBe("no_contact");
  });
  it("manual source is checked before social", () => {
    expect(
      deriveContactStatus({ hasEmail: false, hasSocial: true, emailSource: "needs manual" }),
    ).toBe("needs_manual_check");
  });
});

describe("extractEmailFromText", () => {
  it("finds and lowercases an email", () => {
    expect(extractEmailFromText("Reach me at Hello@Example.COM today")).toBe(
      "hello@example.com",
    );
  });
  it("returns null when no email present", () => {
    expect(extractEmailFromText("no contact info here")).toBeNull();
    expect(extractEmailFromText(null)).toBeNull();
    expect(extractEmailFromText("")).toBeNull();
  });
});

// Build a 28-col cell array (defaults blank) with overrides by index.
function cells28(overrides: Record<number, string>): string[] {
  const arr = Array.from({ length: 28 }, () => "");
  for (const [i, v] of Object.entries(overrides)) arr[Number(i)] = v;
  return arr;
}

function normalizeCells(overrides: Record<number, string>) {
  const mapped = mapRow(cells28(overrides));
  if (!mapped.ok) throw new Error("mapRow failed");
  return normalize(mapped.row);
}

describe("normalize", () => {
  it("rejects a row with no channelId", () => {
    const res = normalizeCells({ 1: "Some Name" }); // index 0 (channelId) blank
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toMatch(/channelId|channelUrl|handle/);
  });

  it("parses a full happy-path row", () => {
    const res = normalizeCells({
      0: "UC123",
      1: "Cool Channel",
      2: "@coolchannel",
      3: "https://youtube.com/@coolchannel",
      4: "1,234,567",
      5: "320",
      6: "98,765,432",
      7: "4.2",
      8: "Mega",
      9: "my",
      10: "2020-05-01",
      11: "hi@cool.com",
      22: "desc text",
      24: "Gaming, Tech",
      25: "gaming setup",
      26: "SG",
      27: "2026-05-01 12:30:00",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const r = res.row;
    expect(r.channelId).toBe("UC123");
    expect(r.handle).toBe("coolchannel"); // @ stripped
    expect(r.subscriberCount).toBe(1_234_567);
    expect(r.viewCount).toBe(98_765_432n);
    expect(r.engagementRate).toBeCloseTo(4.2);
    expect(r.tierDerived).toBe("Mega"); // derived from subs, not tierRaw
    expect(r.countryCode).toBe("MY");
    expect(r.targetCountry).toBe("SG");
    expect(r.hasEmail).toBe(true);
    expect(r.email).toBe("hi@cool.com");
    expect(r.contactStatus).toBe("has_email");
    expect(r.categories).toBe(JSON.stringify(["Gaming", "Tech"]));
    expect(r.joinedDate?.getUTCFullYear()).toBe(2020);
    expect(r.crawledAt?.getUTCHours()).toBe(12);
  });

  it("backfills email from description when email column is empty", () => {
    const res = normalizeCells({
      0: "UC9",
      1: "Name",
      22: "contact: backup@desc.io for business",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.email).toBe("backup@desc.io");
    expect(res.row.emailSource).toBe("description_regex");
    expect(res.row.contactStatus).toBe("has_email");
  });

  it("derives social-only status from a social field", () => {
    const res = normalizeCells({ 0: "UC9", 16: "someinsta" }); // instagram
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.hasEmail).toBe(false);
    expect(res.row.contactStatus).toBe("has_social_only");
    expect(res.row.instagram).toBe("someinsta");
  });

  it("treats noise tokens as null contact", () => {
    const res = normalizeCells({ 0: "UC9", 11: "no email found", 21: "No contact found" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.email).toBeNull();
    expect(res.row.contactSummary).toBeNull();
    expect(res.row.contactStatus).toBe("no_contact");
  });

  it("rejects malformed country codes", () => {
    const res = normalizeCells({ 0: "UC9", 9: "Malaysia" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.countryCode).toBeNull();
  });

  it("serializes channelLinks pipe list to JSON array", () => {
    const res = normalizeCells({ 0: "UC9", 20: "a.com | b.com |  | c.com" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.channelLinks).toBe(JSON.stringify(["a.com", "b.com", "c.com"]));
  });
});
