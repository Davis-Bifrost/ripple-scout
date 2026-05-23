"use client";

import { useState } from "react";
import {
  listDriveFilesAction,
  importFromDriveAction,
  syncDriveAction,
  type DriveFile,
  type SyncResult,
} from "@/app/actions/drive";
import type { UploadResult } from "@/app/actions/upload";

function formatBytes(bytes: number) {
  if (bytes === 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function ResultsTable({ results }: { results: UploadResult[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground">File</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Rows</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">New</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Updated</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Errors</th>
            <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {results.map((r) => (
            <tr key={r.filename}>
              <td className="px-3 py-2 font-mono text-xs">{r.filename}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.totalRows ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.newCount ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">{r.updateCount ?? "—"}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.errorRows ? (
                  <span className="text-destructive">{r.errorRows}</span>
                ) : r.ok ? (
                  "0"
                ) : (
                  "—"
                )}
              </td>
              <td className="px-3 py-2">
                {r.ok && r.imported ? (
                  <span className="text-green-600 font-medium">Imported</span>
                ) : r.error ? (
                  <span className="text-destructive text-xs" title={r.error}>
                    {r.error.length > 60 ? r.error.slice(0, 60) + "…" : r.error}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DriveImport() {
  const [phase, setPhase] = useState<
    "idle" | "syncing" | "sync-done" | "loading" | "listed" | "importing" | "done"
  >("idle");
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<UploadResult[]>([]);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setPhase("syncing");
    setError(null);
    const res = await syncDriveAction();
    if (!res.ok) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    setSyncResult(res.result);
    setPhase("sync-done");
  }

  async function handleList() {
    setPhase("loading");
    setError(null);
    const res = await listDriveFilesAction();
    if (!res.ok) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    setFiles(res.files);
    setSelected(new Set(res.files.map((f) => f.id)));
    setPhase("listed");
  }

  function toggleAll() {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.id)));
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setPhase("importing");
    setError(null);
    const fileIds = Array.from(selected);
    const fileNames = Object.fromEntries(files.map((f) => [f.id, f.name]));
    const res = await importFromDriveAction(fileIds, fileNames);
    setResults(res);
    setPhase("done");
  }

  function handleReset() {
    setPhase("idle");
    setFiles([]);
    setSelected(new Set());
    setResults([]);
    setSyncResult(null);
    setError(null);
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Import from Google Drive</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Sync pulls only new files. Browse lets you pick manually.
          </div>
        </div>
        {phase === "idle" && (
          <div className="flex gap-2">
            <button
              onClick={handleSync}
              className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:opacity-90"
            >
              Sync New Files
            </button>
            <button
              onClick={handleList}
              className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted"
            >
              Browse Drive
            </button>
          </div>
        )}
        {(phase === "done" || phase === "sync-done") && (
          <button
            onClick={handleReset}
            className="rounded-md border px-4 py-1.5 text-sm hover:bg-muted"
          >
            Done
          </button>
        )}
      </div>

      {(phase === "loading" || phase === "syncing") && (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
          {phase === "syncing"
            ? "Checking Drive for new files…"
            : "Fetching file list from Drive…"}
        </div>
      )}

      {error && (
        <div className="px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {/* Sync result summary */}
      {phase === "sync-done" && syncResult && (
        <div>
          <div className="px-4 py-3 border-b flex gap-6 text-sm">
            <span>
              <span className="font-medium text-green-600">{syncResult.imported.filter((r) => r.imported).length}</span>
              <span className="text-muted-foreground ml-1">new files imported</span>
            </span>
            <span>
              <span className="font-medium">{syncResult.skippedCount}</span>
              <span className="text-muted-foreground ml-1">already in DB, skipped</span>
            </span>
            {syncResult.imported.some((r) => !r.ok) && (
              <span>
                <span className="font-medium text-destructive">
                  {syncResult.imported.filter((r) => !r.ok).length}
                </span>
                <span className="text-muted-foreground ml-1">failed</span>
              </span>
            )}
          </div>
          {syncResult.imported.length > 0 && <ResultsTable results={syncResult.imported} />}
          {syncResult.imported.length === 0 && (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              All files are already up to date.
            </div>
          )}
        </div>
      )}

      {/* Manual browse flow */}
      {phase === "listed" && files.length === 0 && (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
          No CSV files found in the Drive folder.
        </div>
      )}

      {phase === "listed" && files.length > 0 && (
        <>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === files.length}
                      onChange={toggleAll}
                      className="cursor-pointer"
                    />
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Filename</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground text-right">Size</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground">Modified</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {files.map((f) => (
                  <tr
                    key={f.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => toggle(f.id)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(f.id)}
                        onChange={() => toggle(f.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{f.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatBytes(f.size)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(f.modifiedTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selected.size} of {files.length} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selected.size === 0}
                className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                Import {selected.size} file{selected.size === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </>
      )}

      {phase === "importing" && (
        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
          Downloading and importing {selected.size} file{selected.size === 1 ? "" : "s"}…
        </div>
      )}

      {phase === "done" && <ResultsTable results={results} />}
    </div>
  );
}
