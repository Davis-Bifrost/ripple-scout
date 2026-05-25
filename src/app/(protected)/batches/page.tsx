import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatNumber, formatDateTime } from "@/lib/utils";

export default async function BatchesPage() {
  const batches = await prisma.uploadBatch.findMany({
    orderBy: { uploadedAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Batches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every CSV upload. Showing the last 200.
          </p>
        </div>
        <Link
          href="/upload"
          className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90"
        >
          New upload
        </Link>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <Th>Filename</Th>
              <Th>Operator</Th>
              <Th>Uploaded</Th>
              <Th className="text-right">Total</Th>
              <Th className="text-right">Valid</Th>
              <Th className="text-right">Imported</Th>
              <Th className="text-right">Dup</Th>
              <Th className="text-right">Errors</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {batches.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  No batches yet. <Link href="/upload" className="text-primary hover:underline">Upload one</Link>.
                </td>
              </tr>
            ) : (
              batches.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <div className="font-medium truncate max-w-[320px]">
                      {b.filename}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(b.fileSize / 1024).toFixed(1)} KB
                    </div>
                  </Td>
                  <Td>
                    {b.operator ? (
                      <Link
                        href={`/channels?operator=${encodeURIComponent(b.operator)}`}
                        className="capitalize text-primary hover:underline"
                      >
                        {b.operator}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td>{formatDateTime(b.uploadedAt)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(b.totalRows)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(b.validRows)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(b.importedRows)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(b.duplicateRows)}</Td>
                  <Td className="text-right tabular-nums">{formatNumber(b.errorRows)}</Td>
                  <Td>
                    <StatusBadge status={b.status} />
                  </Td>
                  <Td>
                    <Link
                      href={
                        b.status === "previewing"
                          ? `/batches/${b.id}/preview`
                          : `/batches/${b.id}`
                      }
                      className="text-primary hover:underline"
                    >
                      {b.status === "previewing" ? "Continue →" : "View →"}
                    </Link>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-xs font-medium text-muted-foreground ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    previewing: "bg-amber-100 text-amber-700",
    committing: "bg-blue-100 text-blue-700",
    imported: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-700",
    pending: "bg-zinc-100 text-zinc-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${map[status] ?? "bg-muted"}`}>
      {status}
    </span>
  );
}
