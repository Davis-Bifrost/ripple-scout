import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: { app: "ripple-scout" },
  timestamp: pino.stdTimeFunctions.isoTime,
  // pino-pretty is intentionally not wired up — keep stdout JSON in all envs
  // so it stays grep-able. If you want pretty local logs, pipe through
  // `pnpm exec pino-pretty`.
});

export function actionLogger(name: string) {
  return logger.child({ action: name });
}
