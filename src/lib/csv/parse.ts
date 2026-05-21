import Papa from "papaparse";
import { mapRow, type RawRow } from "./columns";
import { normalize, type NormalizedRow } from "./normalize";

export type ParseProblem = {
  rowNumber: number;
  reason: string;
  rawRow: string;
};

export type ParsedFile = {
  totalRows: number;
  validRows: NormalizedRow[];
  problems: ParseProblem[];
};

export function parseCsvText(text: string): ParsedFile {
  if (!text.trim()) {
    return {
      totalRows: 0,
      validRows: [],
      problems: [
        {
          rowNumber: 0,
          reason: "File is empty",
          rawRow: "",
        },
      ],
    };
  }

  // header: false — headerless CSV per Ripple Discover format.
  // skipEmptyLines — defensive against trailing newlines.
  const result = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    // newline auto-detection (default), quoteChar '"' (default).
  });

  const validRows: NormalizedRow[] = [];
  const problems: ParseProblem[] = [];
  let total = 0;

  for (let i = 0; i < result.data.length; i++) {
    const cells = result.data[i];
    if (!Array.isArray(cells)) continue;
    // Skip blank rows (papaparse "greedy" already handles, but defensive)
    if (cells.length === 1 && (cells[0] === "" || cells[0] === undefined)) continue;
    total++;

    const rowNumber = i + 1;
    const rawJoined = cells.map((c) => (c ?? "").toString()).join(",").slice(0, 500);

    const mapped = mapRow(cells);
    if (!mapped.ok) {
      problems.push({
        rowNumber,
        reason: `Wrong column count (found ${mapped.error.found}, expected ${mapped.error.expected})`,
        rawRow: rawJoined,
      });
      continue;
    }

    const normalized = normalize(mapped.row);
    if (!normalized.ok) {
      problems.push({
        rowNumber,
        reason: normalized.reason,
        rawRow: rawJoined,
      });
      continue;
    }

    validRows.push(normalized.row);
  }

  // PapaParse-level errors (malformed quotes, etc.)
  for (const err of result.errors) {
    problems.push({
      rowNumber: (err.row ?? 0) + 1,
      reason: `parser: ${err.message}`,
      rawRow: "",
    });
  }

  return { totalRows: total, validRows, problems };
}

export function unparseRows<T extends Record<string, unknown>>(
  rows: T[],
  fields: (keyof T)[],
): string {
  return Papa.unparse(
    {
      fields: fields as string[],
      data: rows.map((r) => fields.map((f) => r[f] ?? "")),
    },
    { quotes: true },
  );
}

export type { RawRow };
