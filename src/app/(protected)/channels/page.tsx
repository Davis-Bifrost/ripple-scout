import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  buildOrderBy,
  buildWhere,
  parseSearchParams,
} from "@/lib/channels-query";
import { FilterBar } from "./filter-bar";
import { formatNumber, formatPercent, formatDate, formatCountry } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { filters, sort, page, pageSize } = parseSearchParams(sp);
  const where = buildWhere(filters);
  const orderBy = buildOrderBy(sort);

  const [
    total,
    rows,
    distinctCountries,
    distinctKeywords,
    distinctOperators,
  ] = await Promise.all([
    prisma.channel.count({ where }),
    prisma.channel.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        channelId: true,
        channelName: true,
        handle: true,
        countryCode: true,
        tierDerived: true,
        subscriberCount: true,
        viewCount: true,
        engagementRate: true,
        email: true,
        contactStatus: true,
        searchKeyword: true,
        joinedDate: true,
        lastSeenAt: true,
      },
    }),
    prisma.$queryRaw<{ countryCode: string }[]>`
      SELECT DISTINCT countryCode FROM Channel
      WHERE countryCode IS NOT NULL ORDER BY countryCode
    `,
    prisma.$queryRaw<{ searchKeyword: string }[]>`
      SELECT DISTINCT searchKeyword FROM Channel
      WHERE searchKeyword IS NOT NULL AND searchKeyword <> ''
      ORDER BY searchKeyword
      LIMIT 200
    `,
    prisma.$queryRaw<{ operator: string }[]>`
      SELECT DISTINCT operator FROM UploadBatch
      WHERE operator IS NOT NULL ORDER BY operator
    `,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatNumber(total)} channels match current filters.
          </p>
        </div>
      </div>

      <FilterBar
        countries={distinctCountries.map((c) => c.countryCode).filter(Boolean)}
        keywords={distinctKeywords.map((k) => k.searchKeyword).filter(Boolean)}
        operators={distinctOperators.map((o) => o.operator).filter(Boolean)}
      />

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <Th>Channel</Th>
                <Th>Country</Th>
                <Th>Tier</Th>
                <Th className="text-right">Subs</Th>
                <Th className="text-right">Views</Th>
                <Th className="text-right">Eng %</Th>
                <Th>Contact</Th>
                <Th>Keyword</Th>
                <Th>Last seen</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No channels match.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/channels/${r.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.channelName}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r.handle ? `@${r.handle} · ` : ""}{r.channelId}
                      </div>
                    </td>
                    <td className="px-3 py-2" title={r.countryCode ?? ""}>
                      {r.countryCode ? formatCountry(r.countryCode) : "—"}
                    </td>
                    <td className="px-3 py-2">{r.tierDerived ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(r.subscriberCount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatNumber(r.viewCount)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.engagementRate !== null ? formatPercent(r.engagementRate, 2) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <ContactBadge status={r.contactStatus} email={r.email} />
                    </td>
                    <td className="px-3 py-2 truncate max-w-[140px]">
                      {r.searchKeyword ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(r.lastSeenAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          searchParams={sp}
        />
      </div>
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

function ContactBadge({ status, email }: { status: string; email: string | null }) {
  const map: Record<string, string> = {
    has_email: "bg-emerald-100 text-emerald-700",
    has_social_only: "bg-indigo-100 text-indigo-700",
    needs_manual_check: "bg-amber-100 text-amber-700",
    no_contact: "bg-zinc-100 text-zinc-600",
  };
  const label: Record<string, string> = {
    has_email: email ?? "email",
    has_social_only: "social",
    needs_manual_check: "manual",
    no_contact: "none",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full truncate max-w-[180px] ${
        map[status] ?? "bg-muted"
      }`}
      title={label[status]}
    >
      {label[status]}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  searchParams,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  function buildUrl(p: number) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string") usp.set(k, v);
    }
    usp.set("page", String(p));
    usp.set("pageSize", String(pageSize));
    return `/channels?${usp.toString()}`;
  }

  return (
    <div className="px-4 py-2 border-t flex items-center justify-between text-sm">
      <div className="text-muted-foreground text-xs">
        Page {page} of {totalPages} · {formatNumber(total)} total
      </div>
      <div className="flex gap-1">
        {page > 1 && (
          <Link href={buildUrl(page - 1)} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">
            ← Prev
          </Link>
        )}
        {page < totalPages && (
          <Link href={buildUrl(page + 1)} className="rounded-md border px-2 py-1 text-xs hover:bg-muted">
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
