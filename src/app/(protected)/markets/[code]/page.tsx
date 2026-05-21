import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getMarketStats,
  listKnownMarkets,
  type MarketScope,
} from "@/lib/stats/market";
import { KpiCard } from "@/components/kpi-card";
import { BarByKey } from "@/components/charts/bar-by-key";
import { ContactPie } from "@/components/charts/contact-pie";
import { DailyOperatorLines } from "@/components/charts/daily-operator-lines";
import { DailyOperatorTable } from "@/components/daily-operator-table";
import {
  formatNumber,
  formatPercent,
  formatCountry,
} from "@/lib/utils";
import { MarketSwitcher } from "./market-switcher";

export const dynamic = "force-dynamic";

const VALID_SCOPES: MarketScope[] = ["based", "targeting", "either"];

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const { code } = await params;
  const { scope: rawScope } = await searchParams;
  if (!/^[a-zA-Z]{2}$/.test(code)) notFound();

  const scope = (
    VALID_SCOPES.includes(rawScope as MarketScope) ? rawScope : "based"
  ) as MarketScope;

  const [stats, known] = await Promise.all([
    getMarketStats(code, scope),
    listKnownMarkets(),
  ]);

  const fullName = formatCountry(code);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs text-muted-foreground">Market</div>
          <h1 className="text-2xl font-semibold mt-0.5">
            {fullName}{" "}
            <span className="text-base font-normal text-muted-foreground">
              ({stats.code})
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scope:{" "}
            <span className="font-medium text-foreground">
              {scope === "based"
                ? `Creators based in ${fullName}`
                : scope === "targeting"
                  ? `Crawls that targeted ${fullName}`
                  : `Creators based in OR targeted at ${fullName}`}
            </span>
          </p>
        </div>
        <MarketSwitcher current={stats.code} scope={scope} markets={known} />
      </div>

      {stats.totalChannels === 0 ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          No channels match this market + scope.
          <div className="mt-2">
            <Link href={`/markets/${stats.code}?scope=either`} className="text-primary hover:underline">
              Try "either" scope →
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KpiCard label="Channels in scope" value={formatNumber(stats.totalChannels)} />
            <KpiCard
              label="Based here"
              value={formatNumber(stats.basedHere)}
              sub={`country=${stats.code}`}
            />
            <KpiCard
              label="Targeting here"
              value={formatNumber(stats.targetingHere)}
              sub={`target=${stats.code}`}
            />
            <KpiCard
              label="With email"
              value={formatNumber(stats.withEmail)}
              sub={formatPercent(stats.emailRate, 1)}
            />
            <KpiCard
              label="Needs manual"
              value={formatNumber(stats.needsManualCheck)}
            />
            <KpiCard
              label="Avg subscribers"
              value={formatNumber(stats.avgSubscribers)}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <ChartCard title="Tier breakdown">
              <BarByKey data={stats.byTier} color="#10b981" />
            </ChartCard>
            <ChartCard title="Contact status">
              <ContactPie data={stats.byContactStatus} />
            </ChartCard>
            <ChartCard title="Channels per operator">
              <BarByKey data={stats.byOperator} color="#8b5cf6" />
            </ChartCard>
          </div>

          {scope !== "based" && stats.byCountryOverlap.length > 1 && (
            <div className="grid grid-cols-1 gap-4">
              <ChartCard title={`Creators' home countries (channels targeting ${stats.code})`}>
                <BarByKey
                  data={stats.byCountryOverlap.map((r) => ({
                    key: r.key,
                    count: r.count,
                  }))}
                  color="#6366f1"
                  height={Math.max(220, stats.byCountryOverlap.length * 24)}
                />
              </ChartCard>
            </div>
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Daily activity in {fullName}</h2>
            {stats.dailyOperator.length === 0 ? (
              <div className="border rounded-lg p-6 text-sm text-muted-foreground">
                No upload activity attributed to this market yet.
              </div>
            ) : (
              <>
                <div className="border rounded-lg p-4 bg-card">
                  <DailyOperatorLines rows={stats.dailyOperator} metric="observations" />
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <DailyOperatorTable rows={stats.dailyOperator} />
                </div>
              </>
            )}
          </section>

          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b text-sm font-medium flex items-center justify-between">
              <span>Top 50 channels in {fullName}</span>
              <Link
                href={
                  scope === "based"
                    ? `/channels?country=${stats.code}&sort=subs_desc`
                    : `/channels?sort=subs_desc`
                }
                className="text-xs text-primary hover:underline"
              >
                Open in channels page →
              </Link>
            </div>
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr className="text-left">
                    <Th>#</Th>
                    <Th>Channel</Th>
                    <Th>Country</Th>
                    <Th>Tier</Th>
                    <Th className="text-right">Subs</Th>
                    <Th className="text-right">Views</Th>
                    <Th className="text-right">Eng %</Th>
                    <Th>Email?</Th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stats.topBySubs.map((r, i) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/channels/${r.id}`} className="font-medium hover:underline">
                          {r.channelName}
                        </Link>
                      </td>
                      <td className="px-3 py-2" title={r.countryCode ?? ""}>
                        {r.countryCode ? formatCountry(r.countryCode) : "—"}
                      </td>
                      <td className="px-3 py-2">{r.tierDerived ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(r.subscriberCount)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatNumber(r.viewCount ? BigInt(r.viewCount) : null)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {r.engagementRate !== null
                          ? formatPercent(r.engagementRate, 2)
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {r.hasEmail ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-700">
                            yes
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">no</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {stats.byKeyword.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b text-sm font-medium">
                Top search keywords for {fullName}
              </div>
              <div className="overflow-x-auto max-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left">
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Keyword</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Channels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stats.byKeyword.map((k) => (
                      <tr key={k.key}>
                        <td className="px-3 py-2">{k.key}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(k.count)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-xs font-medium text-muted-foreground ${className}`}>
      {children}
    </th>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="text-sm font-medium mb-2">{title}</div>
      {children}
    </div>
  );
}
