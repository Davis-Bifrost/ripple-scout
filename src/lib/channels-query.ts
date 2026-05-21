import type { Prisma } from "@prisma/client";

export type ChannelFilters = {
  q?: string;
  countries?: string[];
  tiers?: string[];
  contactStatus?: string;
  searchKeyword?: string;
  batchId?: string;
  operator?: string;
  hasEmail?: "true" | "false";
};

export type ChannelSort =
  | "subs_desc"
  | "subs_asc"
  | "views_desc"
  | "views_asc"
  | "engagement_desc"
  | "joined_desc"
  | "lastSeen_desc";

export function parseSearchParams(sp: Record<string, string | string[] | undefined>) {
  const get = (k: string): string | undefined => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const split = (v: string | undefined) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  const tiers = split(get("tier"));
  const countries = split(get("country"));
  const filters: ChannelFilters = {
    q: get("q") || undefined,
    countries: countries && countries.length ? countries : undefined,
    tiers: tiers && tiers.length ? tiers : undefined,
    contactStatus: get("contactStatus") || undefined,
    searchKeyword: get("searchKeyword") || undefined,
    batchId: get("batchId") || undefined,
    operator: get("operator") || undefined,
    hasEmail: (get("hasEmail") as ChannelFilters["hasEmail"]) || undefined,
  };
  const sort = (get("sort") as ChannelSort) || "subs_desc";
  const page = Math.max(1, Number(get("page") ?? 1));
  const pageSize = Math.min(200, Math.max(10, Number(get("pageSize") ?? 50)));
  return { filters, sort, page, pageSize };
}

export function buildWhere(f: ChannelFilters): Prisma.ChannelWhereInput {
  const where: Prisma.ChannelWhereInput = {};
  if (f.countries && f.countries.length === 1) where.countryCode = f.countries[0];
  else if (f.countries && f.countries.length > 1) where.countryCode = { in: f.countries };
  if (f.tiers && f.tiers.length === 1) where.tierDerived = f.tiers[0];
  else if (f.tiers && f.tiers.length > 1) where.tierDerived = { in: f.tiers };
  if (f.contactStatus) where.contactStatus = f.contactStatus;
  if (f.searchKeyword) where.searchKeyword = f.searchKeyword;
  if (f.hasEmail === "true") where.hasEmail = true;
  if (f.hasEmail === "false") where.hasEmail = false;
  const obsConditions: Prisma.ChannelObservationWhereInput = {};
  if (f.batchId) obsConditions.batchId = f.batchId;
  if (f.operator) obsConditions.batch = { is: { operator: f.operator } };
  if (Object.keys(obsConditions).length) {
    where.observations = { some: obsConditions };
  }
  if (f.q) {
    where.OR = [
      { channelName: { contains: f.q } },
      { handle: { contains: f.q } },
      { channelId: { contains: f.q } },
      { description: { contains: f.q } },
    ];
  }
  return where;
}

export function buildOrderBy(sort: ChannelSort): Prisma.ChannelOrderByWithRelationInput {
  switch (sort) {
    case "subs_asc":
      return { subscriberCount: "asc" };
    case "views_desc":
      return { viewCount: "desc" };
    case "views_asc":
      return { viewCount: "asc" };
    case "engagement_desc":
      return { engagementRate: "desc" };
    case "joined_desc":
      return { joinedDate: "desc" };
    case "lastSeen_desc":
      return { lastSeenAt: "desc" };
    case "subs_desc":
    default:
      return { subscriberCount: "desc" };
  }
}
