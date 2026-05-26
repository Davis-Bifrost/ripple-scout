import { describe, it, expect } from "vitest";
import { formatCountry } from "./utils";

describe("formatCountry", () => {
  it("resolves codes from the static map, not runtime Intl", () => {
    // Node's Intl.DisplayNames renders 'HK' as 'Hong Kong SAR China' while the
    // browser renders 'Hong Kong'. The static map must win so server-rendered
    // and client-hydrated text always match.
    expect(formatCountry("HK")).toBe("Hong Kong");
  });

  it("resolves common codes", () => {
    expect(formatCountry("TW")).toBe("Taiwan");
    expect(formatCountry("MY")).toBe("Malaysia");
    expect(formatCountry("US")).toBe("United States");
  });

  it("is case-insensitive", () => {
    expect(formatCountry("hk")).toBe("Hong Kong");
  });

  it("passes through unknown two-letter codes unchanged", () => {
    expect(formatCountry("QZ")).toBe("QZ");
  });

  it("returns the input unchanged when it is not a two-letter code", () => {
    expect(formatCountry("USA")).toBe("USA");
  });

  it("returns an em dash for empty input", () => {
    expect(formatCountry("")).toBe("—");
    expect(formatCountry(null)).toBe("—");
    expect(formatCountry(undefined)).toBe("—");
  });
});
