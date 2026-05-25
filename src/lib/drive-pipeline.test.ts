import { describe, it, expect } from "vitest";
import { processFilesWindowed } from "./drive-pipeline";

const tick = () => new Promise((r) => setTimeout(r, 5));

describe("processFilesWindowed", () => {
  it("returns an empty array for no files", async () => {
    const out = await processFilesWindowed([], 4, {
      download: async () => Buffer.from(""),
      commit: async () => "x",
      onError: () => "e",
    });
    expect(out).toEqual([]);
  });

  it("runs at most windowSize downloads concurrently", async () => {
    let active = 0;
    let max = 0;
    const files = [0, 1, 2, 3, 4, 5, 6];
    await processFilesWindowed(files, 3, {
      download: async () => {
        active++;
        max = Math.max(max, active);
        await tick();
        active--;
        return Buffer.from("d");
      },
      commit: async () => "ok",
      onError: () => "err",
    });
    expect(max).toBe(3); // never exceeds the window, and reaches it
  });

  it("never runs two commits concurrently", async () => {
    let active = 0;
    let max = 0;
    await processFilesWindowed([0, 1, 2, 3, 4], 4, {
      download: async () => Buffer.from("d"),
      commit: async () => {
        active++;
        max = Math.max(max, active);
        await tick();
        active--;
        return "ok";
      },
      onError: () => "err",
    });
    expect(max).toBe(1);
  });

  it("commits each file only after its own download resolves", async () => {
    const events: string[] = [];
    await processFilesWindowed([0, 1, 2], 2, {
      download: async (f) => {
        await tick();
        events.push(`dl:${f}`);
        return Buffer.from(String(f));
      },
      commit: async (f, buf) => {
        events.push(`commit:${f}:${buf.toString()}`);
        return "ok";
      },
      onError: () => "err",
    });
    // Each commit is preceded by that file's download.
    expect(events).toContain("dl:0");
    expect(events.indexOf("dl:0")).toBeLessThan(events.indexOf("commit:0:0"));
    expect(events.indexOf("dl:2")).toBeLessThan(events.indexOf("commit:2:2"));
  });

  it("preserves input order in the results", async () => {
    const out = await processFilesWindowed([10, 20, 30, 40, 50], 2, {
      download: async (f) => Buffer.from(String(f)),
      commit: async (f) => `c${f}`,
      onError: () => "err",
    });
    expect(out).toEqual(["c10", "c20", "c30", "c40", "c50"]);
  });

  it("isolates a download error to that file without committing it", async () => {
    const committed: number[] = [];
    const errored: number[] = [];
    const out = await processFilesWindowed([0, 1, 2], 3, {
      download: async (f) => {
        if (f === 1) throw new Error("download failed");
        return Buffer.from(String(f));
      },
      commit: async (f) => {
        committed.push(f);
        return `c${f}`;
      },
      onError: (f) => {
        errored.push(f);
        return `e${f}`;
      },
    });
    expect(out).toEqual(["c0", "e1", "c2"]); // order preserved, error in place
    expect(committed).toEqual([0, 2]); // failed file never committed
    expect(errored).toEqual([1]);
  });
});
