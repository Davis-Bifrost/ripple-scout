import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { COUNTRY_NAMES } from "./countries";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | bigint | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const num = typeof n === "bigint" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-US").format(num);
}

export function formatPercent(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Convert an ISO-2 country code (e.g. "TW") to its English name ("Taiwan").
 * Returns the original code unchanged if it can't be resolved.
 *
 * Backed by a static map (COUNTRY_NAMES), not Intl.DisplayNames: the latter's
 * CLDR data differs between Node and the browser, so SSR-ed country labels
 * mismatched their client hydration (e.g. "Hong Kong SAR China" vs "Hong Kong").
 */
export function formatCountry(code: string | null | undefined): string {
  if (!code) return "—";
  const up = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return code;
  return COUNTRY_NAMES[up] ?? up;
}
