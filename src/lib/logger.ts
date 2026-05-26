import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

// Cache the logger on globalThis, mirroring src/lib/db.ts. pino()'s default
// destination (sonic-boom) registers a process 'exit' listener via
// on-exit-leak-free. That library dedups to a single listener — but only when
// it's a shared module. Next's webpack/RSC bundling gives each server bundle
// its own copy of on-exit-leak-free (with its own install guard), so calling
// pino() per-bundle leaks an exit listener each time, tripping
// MaxListenersExceededWarning as you browse routes. A single shared instance
// means pino() runs once, so exactly one exit listener is ever registered.
const globalForLogger = globalThis as unknown as {
  logger: ReturnType<typeof pino> | undefined;
};

export const logger =
  globalForLogger.logger ??
  pino({
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    base: { app: "ripple-scout" },
    timestamp: pino.stdTimeFunctions.isoTime,
    // pino-pretty is intentionally not wired up — keep stdout JSON in all envs
    // so it stays grep-able. If you want pretty local logs, pipe through
    // `pnpm exec pino-pretty`.
  });

globalForLogger.logger = logger;

export function actionLogger(name: string) {
  return logger.child({ action: name });
}
