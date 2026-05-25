/**
 * Process a list of files as a download-then-commit pipeline.
 *
 * Downloads are network-bound and independent, so each window of `windowSize`
 * files is downloaded concurrently. Commits write to the DB and can race on
 * shared channel ids across batches, so they are run strictly one at a time,
 * in input order. A failed download for one file is isolated via `onError` and
 * never reaches `commit`; the rest proceed.
 *
 * Memory is bounded to ~`windowSize` buffers at a time. Deps are injected so
 * this stays pure and DB/network-free for testing.
 */
export async function processFilesWindowed<F, R>(
  files: F[],
  windowSize: number,
  handlers: {
    download: (file: F) => Promise<Buffer>;
    commit: (file: F, buffer: Buffer) => Promise<R>;
    onError: (file: F, error: unknown) => R;
  },
): Promise<R[]> {
  const { download, commit, onError } = handlers;
  const size = Math.max(1, Math.floor(windowSize));
  const results: R[] = [];

  for (let i = 0; i < files.length; i += size) {
    const window = files.slice(i, i + size);

    // Kick off the whole window's downloads at once (bounded by window size).
    const downloaded = await Promise.all(
      window.map(async (file) => {
        try {
          return { ok: true as const, file, buffer: await download(file) };
        } catch (error) {
          return { ok: false as const, file, error };
        }
      }),
    );

    // Commit serially, preserving order.
    for (const d of downloaded) {
      results.push(
        d.ok ? await commit(d.file, d.buffer) : onError(d.file, d.error),
      );
    }
  }

  return results;
}
