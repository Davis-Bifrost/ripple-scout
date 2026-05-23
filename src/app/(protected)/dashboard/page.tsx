import Link from "next/link";
import { getDashboardStats } from "@/lib/stats/aggregate";
import { KpiCard } from "@/components/kpi-card";
import { BarByKey } from "@/components/charts/bar-by-key";
import { ContactPie } from "@/components/charts/contact-pie";
import { CrawledLine } from "@/components/charts/crawled-line";
import { CountryTierStack } from "@/components/charts/country-tier-stack";
import { DailyOperatorLines } from "@/components/charts/daily-operator-lines";
import { DailyOperatorTable } from "@/components/daily-operator-table";
import { formatNumber, formatPercent, formatDateTime, formatCountry } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await getDashboardStats();

  if (s.totalChannels === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No channels imported yet.
          </p>
          <Link
            href="/upload"
            className="inline-block mt-3 text-sm bg-primary text-primary-foreground rounded-md px-4 py-2 hover:opacity-90"
          >
            Upload a CSV →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aggregates across all imported channels.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Unique channels" value={formatNumber(s.totalChannels)} />
        <KpiCard
          label="Observations"
          value={formatNumber(s.totalObservations)}
          sub="rows imported"
        />
        <KpiCard label="Batches" value={formatNumber(s.totalBatches)} />
        <KpiCard
          label="With email"
          value={formatNumber(s.withEmail)}
          sub={formatPercent(s.emailRate, 1)}
        />
        <KpiCard
          label="Needs manual"
          value={formatNumber(s.needsManualCheck)}
        />
        <KpiCard
          label="Avg / Median subs"
          value={`${formatNumber(s.avgSubscribers)}`}
          sub={`median ${formatNumber(s.medianSubscribers)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Channels by country (top 15)">
          <BarByKey data={s.byCountry} color="#6366f1" />
        </ChartCard>
        <ChartCard title="Channels by tier">
          <BarByKey data={s.byTier} color="#10b981" />
        </ChartCard>
        <ChartCard title="Contact status">
          <ContactPie data={s.byContactStatus} />
        </ChartCard>
        <ChartCard title="Observations by crawl date">
          <CrawledLine data={s.byCrawlDate} />
        </ChartCard>
        <ChartCard title="Country × tier (top 12 countries)" className="lg:col-span-2">
          <CountryTierStack data={s.countryTier} />
        </ChartCard>
      </div>

      <OperatorSection
        rows={s.byOperator}
        globalChannels={s.totalChannels}
        globalWithEmail={s.withEmail}
        globalEmailRate={s.emailRate}
        globalAvgSubscribers={s.avgSubscribers}
      />

      <DailyActivitySection
        rows={s.dailyOperator}
        byOperator={s.byOperator}
        globalChannels={s.totalChannels}
        globalWithEmail={s.withEmail}
        globalObservations={s.totalObservations}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopChannelsTable
          title="Top 50 by subscribers"
          rows={s.topBySubs}
          metric="subs"
        />
        <TopChannelsTable
          title="Top 50 by views"
          rows={s.topByViews}
          metric="views"
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b text-sm font-medium">
          Keyword performance (top 50)
        </div>
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr className="text-left">
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Keyword</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Channels</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">With email</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Email rate</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Avg subs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {s.keywordSummary.map((k) => (
                <tr key={k.keyword}>
                  <td className="px-3 py-2">{k.keyword}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(k.channelCount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(k.withEmail)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {k.channelCount
                      ? formatPercent((k.withEmail / k.channelCount) * 100, 1)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(k.avgSubscribers)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border rounded-lg p-4 bg-card ${className}`}>
      <div className="text-sm font-medium mb-2">{title}</div>
      {children}
    </div>
  );
}

function OperatorSection({
  rows,
  globalChannels,
  globalWithEmail,
  globalEmailRate,
  globalAvgSubscribers,
}: {
  rows: Awaited<ReturnType<typeof getDashboardStats>>["byOperator"];
  globalChannels: number;
  globalWithEmail: number;
  globalEmailRate: number;
  globalAvgSubscribers: number;
}) {
  if (!rows.length) return null;

  const chartData = rows.map((r) => ({ key: r.operator, count: r.uniqueChannels }));
  const top = [...rows].sort((a, b) => b.uniqueChannels - a.uniqueChannels);
  // Additive totals — batches / previewBatches / observations partition cleanly
  // by operator (each row belongs to exactly one operator), so summing rows
  // gives the right answer. malaysiaCount is summed at row grain; like the
  // other channel-grain cell sums, it can over-count when a channel is
  // attributed to multiple operators.
  const totals = rows.reduce(
    (acc, r) => {
      acc.batches += r.batches;
      acc.previewBatches += r.previewBatches;
      acc.observations += r.observations;
      acc.malaysiaCount += r.malaysiaCount;
      const last = r.lastUploadAt ? new Date(r.lastUploadAt).getTime() : 0;
      if (last > acc.lastUploadMs) acc.lastUploadMs = last;
      return acc;
    },
    { batches: 0, previewBatches: 0, observations: 0, malaysiaCount: 0, lastUploadMs: 0 },
  );
  // Channel-grain totals come from globals, not row sums — a single channel
  // can be attributed to multiple operators via observations in different
  // operators' batches, which would double-count in a row sum.
  const totalChannels = globalChannels;
  const totalLastUpload = totals.lastUploadMs ? new Date(totals.lastUploadMs) : null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">By operator</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Names parsed from CSV filenames (ripple_&lt;operator&gt;_&hellip;).
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {rows.length} operators · {formatNumber(totalChannels)} channels attributed
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4 bg-card lg:col-span-1">
          <div className="text-sm font-medium mb-2">Channels per operator</div>
          <BarByKey data={chartData} color="#8b5cf6" height={Math.max(220, rows.length * 28)} />
        </div>
        <div className="border rounded-lg overflow-hidden lg:col-span-2">
          <div className="px-4 py-2 border-b text-sm font-medium">
            Operator leaderboard
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Operator</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Imported</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Awaiting</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Observations</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Unique channels</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">With email</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Email rate</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Avg subs</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">🇲🇾 Malaysia</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Last upload</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {top.map((r) => (
                  <tr key={r.operator}>
                    <td className="px-3 py-2 font-medium capitalize">
                      <Link
                        href={`/channels?operator=${encodeURIComponent(r.operator)}`}
                        className="hover:underline"
                      >
                        {r.operator}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.batches)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.previewBatches ? (
                        <span className="text-amber-600">{formatNumber(r.previewBatches)}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.observations)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.uniqueChannels)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.withEmail)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.uniqueChannels ? formatPercent(r.emailRate, 1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.avgSubscribers)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.malaysiaCount)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {r.lastUploadAt ? formatDateTime(r.lastUploadAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t bg-muted/30 font-medium">
                <tr>
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.batches)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totals.previewBatches ? (
                      <span className="text-amber-600">{formatNumber(totals.previewBatches)}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.observations)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totalChannels)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(globalWithEmail)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totalChannels ? formatPercent(globalEmailRate, 1) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {totalChannels ? formatNumber(globalAvgSubscribers) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(totals.malaysiaCount)}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {totalLastUpload ? formatDateTime(totalLastUpload) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function DailyActivitySection({
  rows,
  byOperator,
  globalChannels,
  globalWithEmail,
  globalObservations,
}: {
  rows: Awaited<ReturnType<typeof getDashboardStats>>["dailyOperator"];
  byOperator: Awaited<ReturnType<typeof getDashboardStats>>["byOperator"];
  globalChannels: number;
  globalWithEmail: number;
  globalObservations: number;
}) {
  if (!rows.length) return null;
  const distinctDays = new Set(rows.map((r) => r.day)).size;
  const distinctOps = new Set(rows.map((r) => r.operator)).size;

  const operatorTotals: Record<
    string,
    { observations: number; uniqueChannels: number; withEmail: number }
  > = {};
  for (const op of byOperator) {
    operatorTotals[op.operator] = {
      observations: op.observations,
      uniqueChannels: op.uniqueChannels,
      withEmail: op.withEmail,
    };
  }
  const globalTotals = {
    observations: globalObservations,
    uniqueChannels: globalChannels,
    withEmail: globalWithEmail,
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Daily activity</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-operator output, grouped by upload date.
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {distinctDays} day{distinctDays === 1 ? "" : "s"} · {distinctOps} operator
          {distinctOps === 1 ? "" : "s"}
        </div>
      </div>

      <div className="border rounded-lg p-4 bg-card">
        <div className="text-sm font-medium mb-2">Observations per day</div>
        <DailyOperatorLines rows={rows} metric="observations" />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <DailyOperatorTable
          rows={rows}
          operatorTotals={operatorTotals}
          globalTotals={globalTotals}
        />
      </div>
    </section>
  );
}

function TopChannelsTable({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof getDashboardStats>>["topBySubs"];
  metric: "subs" | "views";
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b text-sm font-medium">{title}</div>
      <div className="overflow-x-auto max-h-[400px]">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="text-left">
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Channel</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Country</th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">
                {metric === "subs" ? "Subs" : "Views"}
              </th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">
                {metric === "subs" ? "Views" : "Subs"}
              </th>
              <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Eng %</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="px-3 py-2">
                  <Link
                    href={`/channels/${r.id}`}
                    className="font-medium hover:underline truncate max-w-[200px] inline-block align-middle"
                  >
                    {r.channelName}
                  </Link>
                </td>
                <td className="px-3 py-2" title={r.countryCode ?? ""}>
                  {r.countryCode ? formatCountry(r.countryCode) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {metric === "subs"
                    ? formatNumber(r.subscriberCount)
                    : formatNumber(r.viewCount ? BigInt(r.viewCount) : null)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {metric === "subs"
                    ? formatNumber(r.viewCount ? BigInt(r.viewCount) : null)
                    : formatNumber(r.subscriberCount)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.engagementRate !== null ? formatPercent(r.engagementRate, 2) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
