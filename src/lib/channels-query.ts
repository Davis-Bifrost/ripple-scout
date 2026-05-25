import type { Prisma } from "@prisma/client";
import { z } from "zod";

const HAS_EMAIL_VALUES = ["true", "false"] as const;
const SORT_VALUES = [
  "subs_desc",
  "subs_asc",
  "views_desc",
  "views_asc",
  "engagement_desc",
  "joined_desc",
  "lastSeen_desc",
] as const;

export type ChannelFilters = {
  q?: string;
  countries?: string[];
  tiers?: string[];
  contactStatus?: string;
  searchKeyword?: string;
  batchId?: string;
  operator?: string;
  hasEmail?: (typeof HAS_EMAIL_VALUES)[number];
};
export type ChannelSort = (typeof SORT_VALUES)[number];

// Exported so server actions can defensively re-validate untrusted input.
export const channelFiltersSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  countries: z.array(z.string().min(2).max(8)).max(50).optional(),
  tiers: z.array(z.string().min(1).max(20)).max(20).optional(),
  contactStatus: z.string().min(1).max(50).optional(),
  searchKeyword: z.string().min(1).max(200).optional(),
  batchId: z.string().min(1).max(60).optional(),
  operator: z.string().min(1).max(100).optional(),
  hasEmail: z.enum(HAS_EMAIL_VALUES).optional(),
});

export const channelSortSchema = z.enum(SORT_VALUES).catch("subs_desc");

const pageSchema = z.coerce.number().int().min(1).catch(1);
const pageSizeSchema = z.coerce.number().int().min(10).max(200).catch(50);

export function parseSearchParams(
  sp: Record<string, string | string[] | undefined>,
) {
  const get = (k: string): string | undefined => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0];
    return v;
  };
  const split = (v: string | undefined): string[] | undefined => {
    if (!v) return undefined;
    const arr = v
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return arr.length ? arr : undefined;
  };

  const raw = {
    q: get("q") || undefined,
    countries: split(get("country")),
    tiers: split(get("tier")),
    contactStatus: get("contactStatus") || undefined,
    searchKeyword: get("searchKeyword") || undefined,
    batchId: get("batchId") || undefined,
    operator: get("operator") || undefined,
    hasEmail: get("hasEmail") || undefined,
  };
  // safeParse: malformed input collapses to no-filter rather than 500ing.
  const parsed = channelFiltersSchema.safeParse(raw);
  const filters: ChannelFilters = parsed.success ? parsed.data : {};

  const sort = channelSortSchema.parse(get("sort") ?? "subs_desc");
  const page = pageSchema.parse(get("page") ?? "1");
  const pageSize = pageSizeSchema.parse(get("pageSize") ?? "50");
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
