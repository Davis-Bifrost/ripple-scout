import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatNumber, formatDateTime } from "@/lib/utils";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batch = await prisma.uploadBatch.findUnique({
    where: { id },
    include: {
      errors: { take: 200, orderBy: { rowNumber: "asc" } },
      _count: { select: { observations: true, errors: true } },
    },
  });
  if (!batch) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/batches" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to batches
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{batch.filename}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Uploaded {formatDateTime(batch.uploadedAt)} · {(batch.fileSize / 1024).toFixed(1)} KB · sha256 {batch.fileHash.slice(0, 12)}…
        </p>
        {batch.operator ? (
          <p className="text-sm mt-1">
            Operator:{" "}
            <Link
              href={`/channels?operator=${encodeURIComponent(batch.operator)}`}
              className="capitalize font-medium text-primary hover:underline"
            >
              {batch.operator}
            </Link>
          </p>
        ) : null}
      </div>

      {batch.status === "previewing" && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 text-sm">
          This batch is awaiting confirmation.{" "}
          <Link
            href={`/batches/${batch.id}/preview`}
            className="text-primary hover:underline font-medium"
          >
            Open preview →
          </Link>
        </div>
      )}

      {batch.status === "committing" && (
        <div className="border border-blue-300 bg-blue-50 rounded-lg p-3 text-sm">
          Commit in progress. Reload this page in a moment to see the result.
        </div>
      )}

      {batch.status === "failed" && (
        <div className="border border-red-300 bg-red-50 rounded-lg p-3 text-sm space-y-1">
          <div>
            Commit failed{batch.notes ? `: ${batch.notes}` : "."} The batch may
            contain partially imported observations; discard it and re-upload
            the source file.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total rows" value={formatNumber(batch.totalRows)} />
        <Stat label="Valid" value={formatNumber(batch.validRows)} />
        <Stat label="Imported" value={formatNumber(batch.importedRows)} />
        <Stat label="Duplicates" value={formatNumber(batch.duplicateRows)} />
        <Stat label="Errors" value={formatNumber(batch.errorRows)} />
      </div>

      <div>
        <h2 className="text-sm font-medium mb-2">
          Observations recorded: {formatNumber(batch._count.observations)}
        </h2>
      </div>

      {batch.errors.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b text-sm font-medium">
            Errors ({batch._count.errors}{batch._count.errors > batch.errors.length ? `, showing first ${batch.errors.length}` : ""})
          </div>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Row</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Reason</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Raw (truncated)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batch.errors.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 tabular-nums">{e.rowNumber}</td>
                    <td className="px-3 py-2 text-destructive">{e.reason}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground truncate max-w-[400px]">
                      {e.rawRow}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
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
