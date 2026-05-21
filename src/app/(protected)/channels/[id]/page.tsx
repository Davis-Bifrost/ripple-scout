import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  formatNumber,
  formatPercent,
  formatDate,
  formatDateTime,
  formatCountry,
} from "@/lib/utils";

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      observations: {
        orderBy: { crawledAt: "desc" },
        take: 200,
        include: { batch: { select: { id: true, filename: true } } },
      },
    },
  });
  if (!channel) notFound();

  let categories: string[] = [];
  try {
    categories = channel.categories ? (JSON.parse(channel.categories) as string[]) : [];
  } catch { /* ignore */ }
  let links: string[] = [];
  try {
    links = channel.channelLinks ? (JSON.parse(channel.channelLinks) as string[]) : [];
  } catch { /* ignore */ }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/channels" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to channels
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{channel.channelName}</h1>
        <p className="text-sm text-muted-foreground mt-1 font-mono">
          {channel.handle ? `@${channel.handle} · ` : ""}{channel.channelId}
        </p>
        {channel.channelUrl ? (
          <a
            href={channel.channelUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary hover:underline"
          >
            {channel.channelUrl} ↗
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Subscribers" value={formatNumber(channel.subscriberCount)} />
        <Stat label="Videos" value={formatNumber(channel.videoCount)} />
        <Stat label="Views" value={formatNumber(channel.viewCount)} />
        <Stat
          label="Engagement"
          value={
            channel.engagementRate !== null
              ? formatPercent(channel.engagementRate, 2)
              : "—"
          }
        />
        <Stat label="Tier" value={channel.tierDerived ?? "—"} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Metadata">
          <KV
            k="Country"
            v={
              channel.countryCode
                ? `${formatCountry(channel.countryCode)} (${channel.countryCode})`
                : "—"
            }
          />
          <KV k="Joined" v={formatDate(channel.joinedDate)} />
          <KV k="Tier (raw)" v={channel.tierRaw ?? "—"} />
          <KV k="First seen" v={formatDateTime(channel.firstSeenAt)} />
          <KV k="Last seen" v={formatDateTime(channel.lastSeenAt)} />
          <KV k="Observations" v={String(channel.observationCount)} />
          <KV k="Last keyword" v={channel.searchKeyword ?? "—"} />
          <KV
            k="Target country"
            v={
              channel.targetCountry
                ? `${formatCountry(channel.targetCountry)} (${channel.targetCountry})`
                : "—"
            }
          />
          <KV k="Categories" v={categories.length ? categories.join(", ") : "—"} />
        </Section>

        <Section title="Contact">
          <KV k="Status" v={channel.contactStatus} />
          <KV k="Email" v={channel.email ?? "—"} />
          <KV k="Email source" v={channel.emailSource ?? "—"} />
          <KV k="WhatsApp" v={channel.whatsapp ?? "—"} />
          <KV k="Phone" v={channel.phone ?? "—"} />
          <KV k="Instagram" v={channel.instagram ?? "—"} />
          <KV k="TikTok" v={channel.tiktok ?? "—"} />
          <KV k="Facebook" v={channel.facebook ?? "—"} />
          <KV k="Twitter" v={channel.twitter ?? "—"} />
          <KV k="Linktree" v={channel.linktree ?? "—"} />
          {links.length > 0 && (
            <div className="col-span-2 mt-2">
              <div className="text-xs text-muted-foreground mb-1">Channel links</div>
              <ul className="space-y-0.5">
                {links.map((l, i) => (
                  <li key={i}>
                    <a
                      href={l}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary hover:underline truncate block"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>

      {channel.description ? (
        <Section title="Description">
          <p className="text-sm whitespace-pre-wrap">{channel.description}</p>
        </Section>
      ) : null}

      {channel.keywords ? (
        <Section title="Keywords">
          <p className="text-sm whitespace-pre-wrap">{channel.keywords}</p>
        </Section>
      ) : null}

      <Section title={`Observations (${channel.observations.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Crawled at</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Batch</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Search keyword</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Subs</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Views</th>
                <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Eng %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {channel.observations.map((o) => (
                <tr key={o.id}>
                  <td className="px-3 py-2">{formatDateTime(o.crawledAt)}</td>
                  <td className="px-3 py-2">
                    <Link href={`/batches/${o.batch.id}`} className="text-primary hover:underline truncate max-w-[200px] inline-block align-middle">
                      {o.batch.filename}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{o.searchKeyword ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(o.subscriberCount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatNumber(o.viewCount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {o.engagementRate !== null ? formatPercent(o.engagementRate, 2) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b bg-card text-sm font-medium">{title}</div>
      <div className="p-4 grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="text-xs text-muted-foreground self-center">{k}</div>
      <div className="text-sm truncate">{v}</div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
