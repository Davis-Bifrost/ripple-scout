"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { uploadCsv, type UploadResult } from "@/app/actions/upload";
import { formatNumber } from "@/lib/utils";

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<UploadResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [autoImport, setAutoImport] = useState(true);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) =>
      f.name.toLowerCase().endsWith(".csv"),
    );
    setFiles((prev) => [...prev, ...incoming]);
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function clearAll() {
    setFiles([]);
    setResults([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  function submit() {
    if (!files.length) return;
    const fd = new FormData();
    for (const f of files) fd.append("files", f);
    fd.append("autoImport", autoImport ? "true" : "false");
    startTransition(async () => {
      const res = await uploadCsv(fd);
      setResults(res);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
          dragOver ? "bg-muted border-primary" : "hover:bg-muted/50"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <p className="font-medium">Drop CSV files here</p>
        <p className="text-sm text-muted-foreground mt-1">
          or click to select. Max 60MB each. Multiple files supported.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="border rounded-lg">
          <div className="px-4 py-2 border-b flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-medium">{files.length} file(s) queued</span>
            <div className="flex gap-3 items-center">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoImport}
                  onChange={(e) => setAutoImport(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                Auto-import after upload
              </label>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={isPending}
                className="text-xs rounded-md bg-primary text-primary-foreground px-3 py-1 hover:opacity-90 disabled:opacity-50"
              >
                {isPending
                  ? autoImport
                    ? "Uploading & importing…"
                    : "Uploading…"
                  : autoImport
                    ? `Upload & import ${files.length} file(s)`
                    : `Upload ${files.length} file(s)`}
              </button>
            </div>
          </div>
          <ul className="divide-y">
            {files.map((f, i) => (
              <li key={i} className="px-4 py-2 flex items-center justify-between text-sm">
                <span className="truncate">{f.name}</span>
                <span className="text-muted-foreground">
                  {(f.size / 1024).toFixed(1)} KB
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="ml-3 text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="border rounded-lg">
          <div className="px-4 py-2 border-b text-sm font-medium">
            Results
          </div>
          <ul className="divide-y">
            {results.map((r, i) => (
              <li key={i} className="px-4 py-3 text-sm flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.filename}</div>
                  {r.ok ? (
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatNumber(r.totalRows)} rows ·{" "}
                      <span className="text-foreground">{formatNumber(r.newCount)} new</span> ·{" "}
                      <span className="text-foreground">{formatNumber(r.updateCount)} update</span>{" "}
                      · {formatNumber(r.intraDup)} dup-in-file · {formatNumber(r.errorRows)} errors
                    </div>
                  ) : (
                    <div className="text-xs text-destructive mt-1">{r.error}</div>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  {r.ok && r.imported ? (
                    <span className="text-xs inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Imported
                    </span>
                  ) : null}
                  {r.ok && r.batchId ? (
                    <Link
                      href={
                        r.imported
                          ? `/batches/${r.batchId}`
                          : `/batches/${r.batchId}/preview`
                      }
                      className="text-xs rounded-md border px-2 py-1 hover:bg-muted"
                    >
                      {r.imported ? "View →" : "Preview →"}
                    </Link>
                  ) : null}
                  {!r.ok && r.duplicateOfBatchId ? (
                    <Link
                      href={`/batches/${r.duplicateOfBatchId}`}
                      className="text-xs rounded-md border px-2 py-1 hover:bg-muted"
                    >
                      View existing
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
