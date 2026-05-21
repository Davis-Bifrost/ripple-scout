"use server";

import { prisma } from "@/lib/db";
import {
  buildOrderBy,
  buildWhere,
  type ChannelFilters,
  type ChannelSort,
} from "@/lib/channels-query";
import Papa from "papaparse";

export async function exportChannelsCsv(
  filters: ChannelFilters,
  sort: ChannelSort,
): Promise<string> {
  const where = buildWhere(filters);
  const orderBy = buildOrderBy(sort);
  const rows = await prisma.channel.findMany({
    where,
    orderBy,
    take: 10000,
    include: {
      lastBatch: { select: { operator: true } },
    },
  });

  const data = rows.map((r, i) => ({
    "#": i + 1,
    operator: r.lastBatch?.operator ?? "",
    channel_id: r.channelId,
    channel_name: r.channelName,
    handle: r.handle ?? "",
    channel_url: r.channelUrl ?? "",
    subscribers: r.subscriberCount ?? "",
    videos: r.videoCount ?? "",
    views: r.viewCount === null ? "" : r.viewCount.toString(),
    engagement_rate: r.engagementRate ?? "",
    tier: r.tierDerived ?? "",
    tier_raw: r.tierRaw ?? "",
    country: r.countryCode ?? "",
    joined_date: r.joinedDate ? r.joinedDate.toISOString().slice(0, 10) : "",
    email: r.email ?? "",
    email_source: r.emailSource ?? "",
    contact_status: r.contactStatus,
    whatsapp: r.whatsapp ?? "",
    phone: r.phone ?? "",
    facebook: r.facebook ?? "",
    instagram: r.instagram ?? "",
    tiktok: r.tiktok ?? "",
    twitter: r.twitter ?? "",
    linktree: r.linktree ?? "",
    channel_links: r.channelLinks ?? "",
    description: r.description ?? "",
    keywords: r.keywords ?? "",
    categories: r.categories ?? "",
    search_keyword: r.searchKeyword ?? "",
    target_country: r.targetCountry ?? "",
    crawled_at: r.crawledAt ? r.crawledAt.toISOString() : "",
    first_seen_at: r.firstSeenAt.toISOString(),
    last_seen_at: r.lastSeenAt.toISOString(),
    observation_count: r.observationCount,
  }));

  return Papa.unparse(data, { quotes: true });
}
