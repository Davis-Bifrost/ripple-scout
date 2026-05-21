/**
 * Positional column map for headerless Ripple Discover CSVs.
 * Files come in two variants: 28-col (with linktree at slot 20) and 27-col (no linktree).
 *
 * If a file's column count doesn't match {27, 28} we reject it with a clear error.
 */

export type RawRow = {
  channelId: string;
  channelName: string;
  handle: string;
  channelUrl: string;
  subscriberCountRaw: string;
  videoCountRaw: string;
  viewCountRaw: string;
  engagementRateRaw: string;
  tierRaw: string;
  countryCodeRaw: string;
  joinedDateRaw: string;
  email: string;
  emailSource: string;
  whatsapp: string;
  phone: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  twitter: string;
  linktree: string;
  channelLinks: string;
  contactSummary: string;
  description: string;
  keywords: string;
  categories: string;
  searchKeyword: string;
  targetCountry: string;
  crawledAtRaw: string;
};

const EMPTY_RAW: RawRow = {
  channelId: "",
  channelName: "",
  handle: "",
  channelUrl: "",
  subscriberCountRaw: "",
  videoCountRaw: "",
  viewCountRaw: "",
  engagementRateRaw: "",
  tierRaw: "",
  countryCodeRaw: "",
  joinedDateRaw: "",
  email: "",
  emailSource: "",
  whatsapp: "",
  phone: "",
  facebook: "",
  instagram: "",
  tiktok: "",
  twitter: "",
  linktree: "",
  channelLinks: "",
  contactSummary: "",
  description: "",
  keywords: "",
  categories: "",
  searchKeyword: "",
  targetCountry: "",
  crawledAtRaw: "",
};

export type ColumnDetectError = {
  kind: "wrong_column_count";
  found: number;
  expected: "27 or 28";
};

export function mapRow(
  cells: string[],
): { ok: true; row: RawRow } | { ok: false; error: ColumnDetectError } {
  const n = cells.length;
  if (n !== 27 && n !== 28) {
    return { ok: false, error: { kind: "wrong_column_count", found: n, expected: "27 or 28" } };
  }

  const get = (i: number) => (cells[i] ?? "").trim();

  if (n === 28) {
    return {
      ok: true,
      row: {
        ...EMPTY_RAW,
        channelId: get(0),
        channelName: get(1),
        handle: get(2),
        channelUrl: get(3),
        subscriberCountRaw: get(4),
        videoCountRaw: get(5),
        viewCountRaw: get(6),
        engagementRateRaw: get(7),
        tierRaw: get(8),
        countryCodeRaw: get(9),
        joinedDateRaw: get(10),
        email: get(11),
        emailSource: get(12),
        whatsapp: get(13),
        phone: get(14),
        facebook: get(15),
        instagram: get(16),
        tiktok: get(17),
        twitter: get(18),
        linktree: get(19),
        channelLinks: get(20),
        contactSummary: get(21),
        description: get(22),
        keywords: get(23),
        categories: get(24),
        searchKeyword: get(25),
        targetCountry: get(26),
        crawledAtRaw: get(27),
      },
    };
  }

  // 27 cols — no linktree slot
  return {
    ok: true,
    row: {
      ...EMPTY_RAW,
      channelId: get(0),
      channelName: get(1),
      handle: get(2),
      channelUrl: get(3),
      subscriberCountRaw: get(4),
      videoCountRaw: get(5),
      viewCountRaw: get(6),
      engagementRateRaw: get(7),
      tierRaw: get(8),
      countryCodeRaw: get(9),
      joinedDateRaw: get(10),
      email: get(11),
      emailSource: get(12),
      whatsapp: get(13),
      phone: get(14),
      facebook: get(15),
      instagram: get(16),
      tiktok: get(17),
      twitter: get(18),
      linktree: "",
      channelLinks: get(19),
      contactSummary: get(20),
      description: get(21),
      keywords: get(22),
      categories: get(23),
      searchKeyword: get(24),
      targetCountry: get(25),
      crawledAtRaw: get(26),
    },
  };
}
