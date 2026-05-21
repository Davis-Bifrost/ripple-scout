import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MarketScope = "based" | "targeting" | "either";

export type MarketStats = {
  code: string;
  scope: MarketScope;
  totalChannels: number;
  basedHere: number;       // creators whose home country is `code`
  targetingHere: number;   // observations crawled while targeting `code`
  withEmail: number;
  emailRate: number;
  needsManualCheck: number;
  avgSubscribers: number;
  totalObservations: number;
  byTier: { key: string; count: number }[];
  byContactStatus: { key: string; count: number }[];
  byOperator: { key: string; count: number }[];
  byCountryOverlap: { key: string; count: number }[]; // creators' home countries in the targeting view
  byKeyword: { key: string; count: number }[];
  topBySubs: TopChannelRow[];
  dailyOperator: DailyOperatorRow[];
};

export type TopChannelRow = {
  id: string;
  channelId: string;
  channelName: string;
  countryCode: string | null;
  subscriberCount: number | null;
  viewCount: string | null;
  engagementRate: number | null;
  tierDerived: string | null;
  hasEmail: boolean;
};

export type DailyOperatorRow = {
  day: string;
  operator: string;
  observations: number;
  uniqueChannels: number;
  withEmail: number;
};

function whereForScope(code: string, scope: MarketScope): Prisma.ChannelWhereInput {
  const up = code.toUpperCase();
  if (scope === "based") return { countryCode: up };
  if (scope === "targeting") return { targetCountry: up };
  return { OR: [{ countryCode: up }, { targetCountry: up }] };
}

const tierOrder = (t: string) =>
  ["New", "Nano", "Micro", "Mid-Tier", "Macro", "Mega"].indexOf(t);

export async function getMarketStats(
  rawCode: string,
  scope: MarketScope = "based",
): Promise<MarketStats> {
  const code = rawCode.toUpperCase();
  const where = whereForScope(code, scope);

  const [
    totalChannels,
    basedHere,
    targetingHere,
    withEmail,
    needsManualCheck,
    subsAgg,
    byTierRaw,
    byContactRaw,
    byCountryOverlapRaw,
    topRows,
    keywordRaw,
    operatorRaw,
    dailyOperatorRaw,
    obsAgg,
  ] = await Promise.all([
    prisma.channel.count({ where }),
    prisma.channel.count({ where: { countryCode: code } }),
    prisma.channel.count({ where: { targetCountry: code } }),
    prisma.channel.count({ where: { ...where, hasEmail: true } }),
    prisma.channel.count({
      where: { ...where, contactStatus: "needs_manual_check" },
    }),
    prisma.channel.aggregate({ where, _avg: { subscriberCount: true } }),
    prisma.channel.groupBy({
      by: ["tierDerived"],
      where,
      _count: { _all: true },
    }),
    prisma.channel.groupBy({
      by: ["contactStatus"],
      where,
      _count: { _all: true },
    }),
    prisma.channel.groupBy({
      by: ["countryCode"],
      where,
      _count: { _all: true },
      orderBy: { _count: { countryCode: "desc" } },
      take: 15,
    }),
    prisma.channel.findMany({
      where,
      orderBy: { subscriberCount: "desc" },
      take: 50,
      select: {
        id: true,
        channelId: true,
        channelName: true,
        countryCode: true,
        subscriberCount: true,
        viewCount: true,
        engagementRate: true,
        tierDerived: true,
        hasEmail: true,
      },
    }),
    prisma.channel.groupBy({
      by: ["searchKeyword"],
      where: { ...where, searchKeyword: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { searchKeyword: "desc" } },
      take: 25,
    }),
    prisma.$queryRaw<{ operator: string; count: number }[]>`
      SELECT ub.operator AS operator, COUNT(DISTINCT c.id) AS count
      FROM Channel c
      JOIN ChannelObservation co ON co.channelRowId = c.id
      JOIN UploadBatch ub ON ub.id = co.batchId
      WHERE ub.operator IS NOT NULL AND ub.status = 'imported'
        AND ${scope === "based"
          ? Prisma.sql`c.countryCode = ${code}`
          : scope === "targeting"
            ? Prisma.sql`c.targetCountry = ${code}`
            : Prisma.sql`(c.countryCode = ${code} OR c.targetCountry = ${code})`}
      GROUP BY ub.operator
      ORDER BY count DESC
    `,
    prisma.$queryRaw<
      {
        day: string;
        operator: string;
        observations: number;
        uniqueChannels: number;
        withEmail: number;
      }[]
    >`
      SELECT
        strftime('%Y-%m-%d', datetime(ub.uploadedAt / 1000, 'unixepoch')) AS day,
        ub.operator AS operator,
        COUNT(co.id) AS observations,
        COUNT(DISTINCT co.channelRowId) AS uniqueChannels,
        SUM(CASE WHEN c.hasEmail = 1 THEN 1 ELSE 0 END) AS withEmail
      FROM UploadBatch ub
      JOIN ChannelObservation co ON co.batchId = ub.id
      JOIN Channel c ON c.id = co.channelRowId
      WHERE ub.operator IS NOT NULL AND ub.status = 'imported'
        AND ${scope === "based"
          ? Prisma.sql`c.countryCode = ${code}`
          : scope === "targeting"
            ? Prisma.sql`c.targetCountry = ${code}`
            : Prisma.sql`(c.countryCode = ${code} OR c.targetCountry = ${code})`}
      GROUP BY day, ub.operator
      ORDER BY day DESC, observations DESC
    `,
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(co.id) AS count
      FROM ChannelObservation co
      JOIN Channel c ON c.id = co.channelRowId
      WHERE ${scope === "based"
        ? Prisma.sql`c.countryCode = ${code}`
        : scope === "targeting"
          ? Prisma.sql`c.targetCountry = ${code}`
          : Prisma.sql`(c.countryCode = ${code} OR c.targetCountry = ${code})`}
    `,
  ]);

  const byTier = byTierRaw
    .map((r) => ({ key: r.tierDerived ?? "Unknown", count: r._count._all }))
    .sort((a, b) => tierOrder(a.key) - tierOrder(b.key));
  const byContactStatus = byContactRaw.map((r) => ({
    key: r.contactStatus,
    count: r._count._all,
  }));
  const byCountryOverlap = byCountryOverlapRaw.map((r) => ({
    key: r.countryCode ?? "—",
    count: r._count._all,
  }));
  const byKeyword = keywordRaw.map((r) => ({
    key: r.searchKeyword ?? "—",
    count: r._count._all,
  }));
  const byOperator = operatorRaw.map((r) => ({
    key: r.operator,
    count: Number(r.count),
  }));

  const topBySubs: TopChannelRow[] = topRows.map((r) => ({
    id: r.id,
    channelId: r.channelId,
    channelName: r.channelName,
    countryCode: r.countryCode,
    subscriberCount: r.subscriberCount,
    viewCount: r.viewCount === null ? null : r.viewCount.toString(),
    engagementRate: r.engagementRate,
    tierDerived: r.tierDerived,
    hasEmail: r.hasEmail,
  }));

  const dailyOperator: DailyOperatorRow[] = dailyOperatorRaw.map((r) => ({
    day: r.day,
    operator: r.operator,
    observations: Number(r.observations),
    uniqueChannels: Number(r.uniqueChannels),
    withEmail: Number(r.withEmail),
  }));

  return {
    code,
    scope,
    totalChannels,
    basedHere,
    targetingHere,
    withEmail,
    emailRate: totalChannels ? (withEmail / totalChannels) * 100 : 0,
    needsManualCheck,
    avgSubscribers: Math.round(subsAgg._avg.subscriberCount ?? 0),
    totalObservations: Number(obsAgg[0]?.count ?? 0),
    byTier,
    byContactStatus,
    byOperator,
    byCountryOverlap,
    byKeyword,
    topBySubs,
    dailyOperator,
  };
}

export async function listKnownMarkets(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ code: string }[]>`
    SELECT DISTINCT code FROM (
      SELECT countryCode AS code FROM Channel WHERE countryCode IS NOT NULL
      UNION
      SELECT targetCountry AS code FROM Channel WHERE targetCountry IS NOT NULL
    )
    ORDER BY code
  `;
  return rows.map((r) => r.code);
}
