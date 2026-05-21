import { prisma } from "@/lib/db";

export type DashboardStats = {
  totalChannels: number;
  totalObservations: number;
  totalBatches: number;
  withEmail: number;
  needsManualCheck: number;
  emailRate: number;
  avgSubscribers: number;
  medianSubscribers: number;
  byCountry: { key: string; count: number }[];
  byTier: { key: string; count: number }[];
  byContactStatus: { key: string; count: number }[];
  byCrawlDate: { date: string; count: number }[];
  byOperator: OperatorRow[];
  dailyOperator: DailyOperatorRow[];
  topBySubs: TopChannelRow[];
  topByViews: TopChannelRow[];
  keywordSummary: KeywordRow[];
  countryTier: { country: string; tier: string; count: number }[];
};

export type OperatorRow = {
  operator: string;
  batches: number;
  previewBatches: number;
  observations: number;
  uniqueChannels: number;
  withEmail: number;
  emailRate: number;
  avgSubscribers: number;
  lastUploadAt: string | null;
};

export type DailyOperatorRow = {
  day: string;       // YYYY-MM-DD
  operator: string;
  observations: number;
  uniqueChannels: number;
  withEmail: number;
};

export type TopChannelRow = {
  id: string;
  channelId: string;
  channelName: string;
  countryCode: string | null;
  subscriberCount: number | null;
  viewCount: string | null; // bigint serialized
  engagementRate: number | null;
  tierDerived: string | null;
  hasEmail: boolean;
};

export type KeywordRow = {
  keyword: string;
  channelCount: number;
  withEmail: number;
  avgSubscribers: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    totalChannels,
    totalObservations,
    totalBatches,
    withEmail,
    needsManualCheck,
    subsAgg,
    byCountryRaw,
    byTierRaw,
    byContactRaw,
    byCrawlRaw,
    topBySubsRaw,
    topByViewsRaw,
    keywordRaw,
    countryTierRaw,
    medianRaw,
    operatorRaw,
    dailyOperatorRaw,
  ] = await Promise.all([
    prisma.channel.count(),
    prisma.channelObservation.count(),
    prisma.uploadBatch.count({ where: { status: "imported" } }),
    prisma.channel.count({ where: { hasEmail: true } }),
    prisma.channel.count({ where: { contactStatus: "needs_manual_check" } }),
    prisma.channel.aggregate({ _avg: { subscriberCount: true } }),
    prisma.channel.groupBy({
      by: ["countryCode"],
      _count: { _all: true },
      orderBy: { _count: { countryCode: "desc" } },
      take: 15,
    }),
    prisma.channel.groupBy({
      by: ["tierDerived"],
      _count: { _all: true },
    }),
    prisma.channel.groupBy({
      by: ["contactStatus"],
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ day: string; count: number }[]>`
      SELECT strftime('%Y-%m-%d', datetime(crawledAt / 1000, 'unixepoch')) AS day, COUNT(*) AS count
      FROM ChannelObservation
      WHERE crawledAt IS NOT NULL
      GROUP BY day
      ORDER BY day ASC
      LIMIT 90
    `,
    prisma.channel.findMany({
      where: { subscriberCount: { not: null } },
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
    prisma.channel.findMany({
      where: { viewCount: { not: null } },
      orderBy: { viewCount: "desc" },
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
    prisma.$queryRaw<
      { keyword: string; channelCount: number; withEmail: number; avgSubscribers: number }[]
    >`
      SELECT searchKeyword AS keyword,
             COUNT(*) AS channelCount,
             SUM(CASE WHEN hasEmail = 1 THEN 1 ELSE 0 END) AS withEmail,
             COALESCE(AVG(subscriberCount), 0) AS avgSubscribers
      FROM Channel
      WHERE searchKeyword IS NOT NULL AND searchKeyword <> ''
      GROUP BY searchKeyword
      ORDER BY channelCount DESC
      LIMIT 50
    `,
    prisma.$queryRaw<{ country: string; tier: string; count: number }[]>`
      SELECT countryCode AS country, tierDerived AS tier, COUNT(*) AS count
      FROM Channel
      WHERE countryCode IS NOT NULL AND tierDerived IS NOT NULL
      GROUP BY countryCode, tierDerived
      ORDER BY count DESC
    `,
    prisma.$queryRaw<{ median: number | null }[]>`
      SELECT subscriberCount AS median
      FROM Channel
      WHERE subscriberCount IS NOT NULL
      ORDER BY subscriberCount
      LIMIT 1 OFFSET (SELECT COUNT(*) / 2 FROM Channel WHERE subscriberCount IS NOT NULL)
    `,
    prisma.$queryRaw<
      {
        operator: string;
        batches: number;
        previewBatches: number;
        observations: number;
        uniqueChannels: number;
        withEmail: number;
        avgSubscribers: number;
        lastUploadAt: number | null;
      }[]
    >`
      SELECT
        ub.operator AS operator,
        SUM(CASE WHEN ub.status = 'imported' THEN 1 ELSE 0 END) AS batches,
        SUM(CASE WHEN ub.status = 'previewing' THEN 1 ELSE 0 END) AS previewBatches,
        COUNT(co.id) AS observations,
        COUNT(DISTINCT co.channelRowId) AS uniqueChannels,
        SUM(CASE WHEN c.hasEmail = 1 THEN 1 ELSE 0 END) AS withEmail,
        COALESCE(AVG(c.subscriberCount), 0) AS avgSubscribers,
        MAX(ub.uploadedAt) AS lastUploadAt
      FROM UploadBatch ub
      LEFT JOIN ChannelObservation co ON co.batchId = ub.id
      LEFT JOIN Channel c ON c.id = co.channelRowId
      WHERE ub.operator IS NOT NULL
      GROUP BY ub.operator
      ORDER BY uniqueChannels DESC, ub.operator
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
      LEFT JOIN ChannelObservation co ON co.batchId = ub.id
      LEFT JOIN Channel c ON c.id = co.channelRowId
      WHERE ub.operator IS NOT NULL AND ub.status = 'imported' AND co.id IS NOT NULL
      GROUP BY day, ub.operator
      ORDER BY day DESC, observations DESC
    `,
  ]);

  const byCountry = byCountryRaw.map((r) => ({
    key: r.countryCode ?? "—",
    count: r._count._all,
  }));
  const byTier = byTierRaw
    .map((r) => ({ key: r.tierDerived ?? "Unknown", count: r._count._all }))
    .sort((a, b) => tierOrder(a.key) - tierOrder(b.key));
  const byContactStatus = byContactRaw.map((r) => ({
    key: r.contactStatus,
    count: r._count._all,
  }));

  const byCrawlDate = byCrawlRaw.map((r) => ({
    date: r.day,
    count: Number(r.count),
  }));

  const top = (rows: typeof topBySubsRaw): TopChannelRow[] =>
    rows.map((r) => ({
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

  const keywordSummary: KeywordRow[] = keywordRaw.map((k) => ({
    keyword: k.keyword,
    channelCount: Number(k.channelCount),
    withEmail: Number(k.withEmail),
    avgSubscribers: Math.round(Number(k.avgSubscribers)),
  }));

  const countryTier = countryTierRaw.map((r) => ({
    country: r.country,
    tier: r.tier,
    count: Number(r.count),
  }));

  const dailyOperator: DailyOperatorRow[] = dailyOperatorRaw.map((r) => ({
    day: r.day,
    operator: r.operator,
    observations: Number(r.observations),
    uniqueChannels: Number(r.uniqueChannels),
    withEmail: Number(r.withEmail),
  }));

  const byOperator: OperatorRow[] = operatorRaw.map((r) => {
    const unique = Number(r.uniqueChannels);
    const withE = Number(r.withEmail);
    const lastMs =
      r.lastUploadAt === null || r.lastUploadAt === undefined
        ? null
        : Number(r.lastUploadAt);
    return {
      operator: r.operator,
      batches: Number(r.batches),
      previewBatches: Number(r.previewBatches),
      observations: Number(r.observations),
      uniqueChannels: unique,
      withEmail: withE,
      emailRate: unique ? (withE / unique) * 100 : 0,
      avgSubscribers: Math.round(Number(r.avgSubscribers)),
      lastUploadAt: lastMs ? new Date(lastMs).toISOString() : null,
    };
  });

  return {
    totalChannels,
    totalObservations,
    totalBatches,
    withEmail,
    needsManualCheck,
    emailRate: totalChannels ? (withEmail / totalChannels) * 100 : 0,
    avgSubscribers: Math.round(subsAgg._avg.subscriberCount ?? 0),
    medianSubscribers: Number(medianRaw[0]?.median ?? 0),
    byCountry,
    byTier,
    byContactStatus,
    byCrawlDate,
    byOperator,
    dailyOperator,
    topBySubs: top(topBySubsRaw),
    topByViews: top(topByViewsRaw),
    keywordSummary,
    countryTier,
  };
}

function tierOrder(t: string): number {
  const order = ["New", "Nano", "Micro", "Mid-Tier", "Macro", "Mega"];
  const i = order.indexOf(t);
  return i === -1 ? 99 : i;
}
