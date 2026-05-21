import fs from "node:fs/promises";
import path from "node:path";
import type { NormalizedRow } from "./normalize";
import type { ParseProblem } from "./parse";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export type StoredPreview = {
  rows: SerializedNormalizedRow[];
  problems: ParseProblem[];
};

type SerializedNormalizedRow = Omit<
  NormalizedRow,
  "viewCount" | "joinedDate" | "crawledAt"
> & {
  viewCount: string | null;
  joinedDate: string | null;
  crawledAt: string | null;
};

function serialize(r: NormalizedRow): SerializedNormalizedRow {
  return {
    ...r,
    viewCount: r.viewCount === null ? null : r.viewCount.toString(),
    joinedDate: r.joinedDate ? r.joinedDate.toISOString() : null,
    crawledAt: r.crawledAt ? r.crawledAt.toISOString() : null,
  };
}

function deserialize(r: SerializedNormalizedRow): NormalizedRow {
  return {
    ...r,
    viewCount: r.viewCount === null ? null : BigInt(r.viewCount),
    joinedDate: r.joinedDate ? new Date(r.joinedDate) : null,
    crawledAt: r.crawledAt ? new Date(r.crawledAt) : null,
  };
}

export async function savePreview(
  batchId: string,
  rows: NormalizedRow[],
  problems: ParseProblem[],
): Promise<void> {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const payload: StoredPreview = {
    rows: rows.map(serialize),
    problems,
  };
  await fs.writeFile(
    path.join(UPLOAD_DIR, `${batchId}.json`),
    JSON.stringify(payload),
    "utf-8",
  );
}

export async function loadPreview(
  batchId: string,
): Promise<{ rows: NormalizedRow[]; problems: ParseProblem[] } | null> {
  try {
    const raw = await fs.readFile(
      path.join(UPLOAD_DIR, `${batchId}.json`),
      "utf-8",
    );
    const parsed = JSON.parse(raw) as StoredPreview;
    return {
      rows: parsed.rows.map(deserialize),
      problems: parsed.problems,
    };
  } catch {
    return null;
  }
}

export async function discardPreview(batchId: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, `${batchId}.json`));
  } catch {
    /* ignore */
  }
}
