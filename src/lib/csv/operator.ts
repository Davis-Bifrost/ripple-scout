/**
 * Filename → operator name extractor.
 *
 * Ripple Discover CSV files use the convention:
 *   ripple_<operator>_<kind>_<n>.csv     →  operator captured
 *   ripple_<kind>_<n>.csv                →  no operator (returns null)
 *
 * Where <kind> is a word like "data" / "scout" / "kol", <n> is the version.
 * The operator is the second token when it isn't itself a known kind.
 */

const KIND_TOKENS = new Set([
  "data",
  "scout",
  "kol",
  "spider",
  "discover",
  "discovery",
  "raw",
  "v",
]);

const NAME_RE = /^[A-Za-z][A-Za-z0-9-]{0,40}$/;

/**
 * Returns a lowercase operator name like "davis" / "christina" / "abc",
 * or null if the filename has no recognizable operator slot.
 */
export function extractOperator(filename: string): string | null {
  // Strip path and extension. Use lowercase for token matching.
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const stem = base.replace(/\.[^.]+$/, "");

  const parts = stem.split(/[_\s-]+/).filter(Boolean);

  // Expected first token is "ripple". If it isn't, still try parts[0] as the
  // operator when it looks like a name and isn't a kind token.
  let startIdx = 0;
  if (parts[0]?.toLowerCase() === "ripple") startIdx = 1;

  const candidate = parts[startIdx];
  if (!candidate) return null;

  const lower = candidate.toLowerCase();
  if (KIND_TOKENS.has(lower)) return null;
  // version token like "v1" / "v12"
  if (/^v\d+$/i.test(candidate)) return null;
  if (!NAME_RE.test(candidate)) return null;

  return lower;
}
