import { describe, it, expect } from "vitest";
import { mapRow } from "./columns";

function row(n: number, fill = (i: number) => `c${i}`): string[] {
  return Array.from({ length: n }, (_, i) => fill(i));
}

describe("mapRow", () => {
  it("rejects column counts other than 27 or 28", () => {
    for (const n of [0, 1, 26, 29, 50]) {
      const res = mapRow(row(n));
      expect(res.ok).toBe(false);
      if (res.ok) continue;
      expect(res.error.kind).toBe("wrong_column_count");
      expect(res.error.found).toBe(n);
    }
  });

  it("maps a 28-column row including linktree at slot 19", () => {
    const res = mapRow(row(28));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.channelId).toBe("c0");
    expect(res.row.linktree).toBe("c19");
    expect(res.row.channelLinks).toBe("c20");
    expect(res.row.crawledAtRaw).toBe("c27");
  });

  it("maps a 27-column row with no linktree slot (shifts later fields)", () => {
    const res = mapRow(row(27));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.linktree).toBe(""); // no slot in 27-col variant
    expect(res.row.channelLinks).toBe("c19"); // shifted up by one
    expect(res.row.crawledAtRaw).toBe("c26");
  });

  it("trims whitespace from cells", () => {
    const cells = row(28, (i) => (i === 0 ? "  UC1  " : ""));
    const res = mapRow(cells);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.row.channelId).toBe("UC1");
  });
});
