import type { RawRow } from "./columns";

export type NormalizedRow = {
  channelId: string;
  channelName: string;
  handle: string | null;
  channelUrl: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  viewCount: bigint | null;
  engagementRate: number | null;
  tierRaw: string | null;
  tierDerived: string;
  countryCode: string | null;
  joinedDate: Date | null;
  email: string | null;
  emailSource: string | null;
  hasEmail: boolean;
  contactStatus: ContactStatus;
  whatsapp: string | null;
  phone: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  twitter: string | null;
  linktree: string | null;
  channelLinks: string | null;
  contactSummary: string | null;
  description: string | null;
  keywords: string | null;
  categories: string | null;
  searchKeyword: string | null;
  targetCountry: string | null;
  crawledAt: Date | null;
};

export type ContactStatus =
  | "has_email"
  | "has_social_only"
  | "needs_manual_check"
  | "no_contact";

const NOISE = new Set([
  "",
  "no contact found",
  "no email found",
  "n/a",
  "na",
  "none",
  "null",
  "needs_manual",
  "no_contact",
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function cleanText(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  if (!t) return null;
  if (NOISE.has(t.toLowerCase())) return null;
  return t;
}

function cleanContactField(v: string): string | null {
  const t = cleanText(v);
  if (!t) return null;
  // "needs_manual" sometimes appears as a value — already filtered above
  return t;
}

function stripHandle(v: string | null): string | null {
  if (!v) return null;
  return v.replace(/^@+/, "").trim() || null;
}

function parseInteger(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[\s,]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseBigIntSafe(v: string): bigint | null {
  if (!v) return null;
  const cleaned = v.replace(/[\s,]/g, "");
  if (!cleaned || !/^-?\d+$/.test(cleaned)) {
    const n = parseInteger(cleaned);
    return n === null ? null : BigInt(n);
  }
  try {
    return BigInt(cleaned);
  } catch {
    return null;
  }
}

function parseFloatSafe(v: string): number | null {
  if (!v) return null;
  const cleaned = v.replace(/[\s,]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: string): Date | null {
  const t = v?.trim();
  if (!t) return null;
  // Accept YYYY-MM-DD or YYYY-MM-DD HH:MM:SS
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
  if (!m) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, da, hh, mm, ss] = m;
  const d = new Date(
    Date.UTC(+y, +mo - 1, +da, hh ? +hh : 0, mm ? +mm : 0, ss ? +ss : 0),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeCountry(v: string): string | null {
  const t = cleanText(v);
  if (!t) return null;
  const up = t.toUpperCase();
  return /^[A-Z]{2}$/.test(up) ? up : null;
}

const KNOWN_TIERS = new Set([
  "Nano",
  "Micro",
  "Mid-Tier",
  "Macro",
  "Mega",
  "New",
]);

function normalizeTier(v: string): string | null {
  const t = cleanText(v);
  if (!t) return null;
  if (KNOWN_TIERS.has(t)) return t;
  // Try case-insensitive
  for (const k of KNOWN_TIERS) {
    if (k.toLowerCase() === t.toLowerCase()) return k;
  }
  return t; // keep unknown labels as-is; downstream may still want them
}

export function deriveTier(subs: number | null): string {
  if (subs === null || !Number.isFinite(subs)) return "Unknown";
  if (subs >= 1_000_000) return "Mega";
  if (subs >= 500_000) return "Macro";
  if (subs >= 100_000) return "Mid-Tier";
  if (subs >= 10_000) return "Micro";
  if (subs >= 1_000) return "Nano";
  if (subs > 0) return "New";
  return "Unknown";
}

export function deriveContactStatus(args: {
  hasEmail: boolean;
  hasSocial: boolean;
  emailSource: string | null;
}): ContactStatus {
  if (args.hasEmail) return "has_email";
  if (args.emailSource && args.emailSource.toLowerCase().includes("manual")) {
    return "needs_manual_check";
  }
  if (args.hasSocial) return "has_social_only";
  return "no_contact";
}

export function extractEmailFromText(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(EMAIL_RE);
  return m ? m[0].toLowerCase() : null;
}

export type NormalizeResult =
  | { ok: true; row: NormalizedRow }
  | { ok: false; reason: string };

export function normalize(raw: RawRow): NormalizeResult {
  if (!raw.channelId && !raw.channelUrl && !raw.handle) {
    return { ok: false, reason: "missing channelId/channelUrl/handle" };
  }

  const channelId = (raw.channelId || "").trim();
  if (!channelId) {
    return { ok: false, reason: "missing channelId" };
  }

  const channelName = (raw.channelName || "").trim() || "(unnamed)";
  const handle = stripHandle(cleanText(raw.handle));
  const channelUrl = cleanText(raw.channelUrl);

  const subscriberCount = parseInteger(raw.subscriberCountRaw);
  const videoCount = parseInteger(raw.videoCountRaw);
  const viewCount = parseBigIntSafe(raw.viewCountRaw);
  const engagementRate = parseFloatSafe(raw.engagementRateRaw);

  const tierRaw = normalizeTier(raw.tierRaw);
  const tierDerived = deriveTier(subscriberCount);

  const countryCode = normalizeCountry(raw.countryCodeRaw);
  const joinedDate = parseDate(raw.joinedDateRaw);

  let email = cleanText(raw.email);
  let emailSource = cleanText(raw.emailSource);

  // Backup: try to extract email from description if missing
  if (!email) {
    const fromDesc = extractEmailFromText(raw.description);
    if (fromDesc) {
      email = fromDesc;
      if (!emailSource) emailSource = "description_regex";
    }
  }

  const whatsapp = cleanContactField(raw.whatsapp);
  const phone = cleanContactField(raw.phone);
  const facebook = cleanContactField(raw.facebook);
  const instagram = stripHandle(cleanContactField(raw.instagram));
  const tiktok = stripHandle(cleanContactField(raw.tiktok));
  const twitter = stripHandle(cleanContactField(raw.twitter));
  const linktree = stripHandle(cleanContactField(raw.linktree));

  const channelLinksRaw = cleanText(raw.channelLinks);
  const channelLinks = channelLinksRaw
    ? JSON.stringify(
        channelLinksRaw
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;

  const contactSummary = cleanText(raw.contactSummary);
  const description = (raw.description || "").trim() || null;
  const keywords = cleanText(raw.keywords);
  const categoriesRaw = cleanText(raw.categories);
  const categories = categoriesRaw
    ? JSON.stringify(
        categoriesRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      )
    : null;
  const searchKeyword = cleanText(raw.searchKeyword);
  const targetCountry = normalizeCountry(raw.targetCountry);
  const crawledAt = parseDate(raw.crawledAtRaw);

  const hasEmail = !!email;
  const hasSocial = !!(
    whatsapp ||
    phone ||
    facebook ||
    instagram ||
    tiktok ||
    twitter ||
    linktree
  );
  const contactStatus = deriveContactStatus({
    hasEmail,
    hasSocial,
    emailSource,
  });

  return {
    ok: true,
    row: {
      channelId,
      channelName,
      handle,
      channelUrl,
      subscriberCount,
      videoCount,
      viewCount,
      engagementRate,
      tierRaw,
      tierDerived,
      countryCode,
      joinedDate,
      email,
      emailSource,
      hasEmail,
      contactStatus,
      whatsapp,
      phone,
      facebook,
      instagram,
      tiktok,
      twitter,
      linktree,
      channelLinks,
      contactSummary,
      description,
      keywords,
      categories,
      searchKeyword,
      targetCountry,
      crawledAt,
    },
  };
}
