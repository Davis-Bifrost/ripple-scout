import { describe, it, expect } from "vitest";
import { parseCsvText } from "./parse";

// A string is "well-formed" UTF-16 when it contains no unpaired surrogate.
// With the /u flag, valid surrogate pairs collapse into a single astral code
// point, so \p{Surrogate} matches ONLY lone/unpaired surrogates.
const hasLoneSurrogate = (s: string) => /\p{Surrogate}/u.test(s);

describe("parseCsvText problem rawRow is well-formed UTF-16", () => {
  it("does not leave a lone surrogate when the 500-char slice cuts an emoji", () => {
    // 😀 (U+1F600) is a surrogate pair occupying code units 499 and 500, so a
    // naive slice(0, 500) keeps the high half and drops the low half.
    const cell = "a".repeat(499) + "😀extra";
    const { problems } = parseCsvText(cell); // 1 column → wrong column count

    const problem = problems.find((p) => p.reason.startsWith("Wrong column count"));
    expect(problem).toBeDefined();
    expect(hasLoneSurrogate(problem!.rawRow)).toBe(false);
  });

  it("strips a lone surrogate that is already present mid-string", () => {
    // Upstream decoding of binary/garbled CSV bytes can yield unpaired
    // surrogates that the slice never touches.
    const cell = "hello" + String.fromCharCode(0xd83d) + "world";
    const { problems } = parseCsvText(cell);

    expect(problems.length).toBeGreaterThan(0);
    expect(hasLoneSurrogate(problems[0].rawRow)).toBe(false);
  });
});
