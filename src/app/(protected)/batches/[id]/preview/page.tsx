import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { loadPreview } from "@/lib/csv/storage";
import { classifyRows, summarizeClassification } from "@/lib/csv/dedup";
import { formatNumber, formatPercent, formatCountry } from "@/lib/utils";
import { CommitButton } from "./commit-button";

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batch = await prisma.uploadBatch.findUnique({ where: { id } });
  if (!batch) notFound();
  if (batch.status !== "previewing") redirect(`/batches/${id}`);

  const preview = await loadPreview(id);
  if (!preview) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Preview unavailable</h1>
        <p className="text-sm text-muted-foreground">
          The staged preview file for batch {id} could not be read. Try
          re-uploading.
        </p>
      </div>
    );
  }

  const classified = await classifyRows(preview.rows);
  const summary = summarizeClassification(classified);
  const sampleSize = 50;
  const sample = classified.slice(0, sampleSize);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Preview: {batch.filename}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Uploaded {new Date(batch.uploadedAt).toLocaleString()} · {(batch.fileSize / 1024).toFixed(1)} KB
            {batch.operator ? (
              <>
                {" "}· Operator{" "}
                <span className="capitalize font-medium text-foreground">
                  {batch.operator}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <CommitButton batchId={id} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCell label="Total rows" value={formatNumber(batch.totalRows)} />
        <KpiCell label="Valid" value={formatNumber(preview.rows.length)} />
        <KpiCell
          label="New"
          value={formatNumber(summary.newCount)}
          tone="success"
        />
        <KpiCell
          label="Updates"
          value={formatNumber(summary.updateCount)}
          tone="warning"
        />
        <KpiCell
          label="Errors"
          value={formatNumber(preview.problems.length)}
          tone={preview.problems.length ? "destructive" : undefined}
        />
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b text-sm font-medium flex items-center justify-between">
          <span>Sample (first {sample.length} of {classified.length})</span>
          <span className="text-xs text-muted-foreground">
            Dedup key: channelId
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <Th>#</Th>
                <Th>Channel</Th>
                <Th>Country</Th>
                <Th>Tier</Th>
                <Th>Subs</Th>
                <Th>Email</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sample.map((r, i) => (
                <tr key={`${r.channelId}-${i}`}>
                  <Td className="text-muted-foreground tabular-nums">{i + 1}</Td>
                  <Td>
                    <div className="font-medium truncate max-w-[260px]">
                      {r.channelName}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[260px]">
                      {r.handle ? `@${r.handle} · ` : ""}{r.channelId}
                    </div>
                  </Td>
                  <Td title={r.countryCode ?? ""}>
                    {r.countryCode ? formatCountry(r.countryCode) : "—"}
                  </Td>
                  <Td>{r.tierDerived}</Td>
                  <Td className="tabular-nums">{formatNumber(r.subscriberCount)}</Td>
                  <Td className="truncate max-w-[200px]">{r.email ?? "—"}</Td>
                  <Td>
                    <Badge classification={r.classification} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t text-xs text-muted-foreground">
          Email rate in preview:{" "}
          {formatPercent(
            classified.length
              ? (classified.filter((r) => r.hasEmail).length / classified.length) * 100
              : 0,
            1,
          )}
        </div>
      </div>

      {preview.problems.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b text-sm font-medium">
            Errors ({preview.problems.length})
          </div>
          <div className="overflow-x-auto max-h-[300px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <Th>Row</Th>
                  <Th>Reason</Th>
                  <Th>Raw (truncated)</Th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.problems.slice(0, 200).map((p, i) => (
                  <tr key={i}>
                    <Td className="tabular-nums">{p.rowNumber}</Td>
                    <Td className="text-destructive">{p.reason}</Td>
                    <Td className="font-mono text-xs text-muted-foreground truncate max-w-[400px]">
                      {p.rawRow}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-between text-sm">
        <Link href="/upload" className="text-muted-foreground hover:text-foreground">
          ← Back to upload
        </Link>
        <CommitButton batchId={id} />
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-xs font-medium text-muted-foreground">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return <td className={`px-3 py-2 align-top ${className}`} title={title}>{children}</td>;
}

function Badge({ classification }: { classification: string }) {
  const map: Record<string, string> = {
    new: "bg-emerald-100 text-emerald-700",
    update: "bg-amber-100 text-amber-700",
    intra_batch_duplicate: "bg-zinc-200 text-zinc-700",
  };
  const label: Record<string, string> = {
    new: "New",
    update: "Update",
    intra_batch_duplicate: "Dup in file",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${
        map[classification] ?? "bg-muted"
      }`}
    >
      {label[classification] ?? classification}
    </span>
  );
}

function KpiCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-700"
      : tone === "warning"
        ? "text-amber-700"
        : tone === "destructive"
          ? "text-destructive"
          : "";
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold mt-1 tabular-nums ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
