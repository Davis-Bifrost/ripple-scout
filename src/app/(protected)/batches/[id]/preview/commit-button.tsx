"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { commitBatch, discardBatch } from "@/app/actions/upload";

export function CommitButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex gap-2 items-center">
      {err ? <span className="text-xs text-destructive">{err}</span> : null}
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm("Discard this batch and its staged data?")) return;
          startTransition(async () => {
            await discardBatch(batchId);
          });
        }}
        className="text-sm border rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
      >
        Discard
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const res = await commitBatch(batchId);
            if (!res.ok) {
              setErr(res.error || "Import failed");
              return;
            }
            router.push(`/batches/${batchId}`);
            router.refresh();
          });
        }}
        className="text-sm bg-primary text-primary-foreground rounded-md px-3 py-1.5 hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Importing…" : "Import"}
      </button>
    </div>
  );
}
