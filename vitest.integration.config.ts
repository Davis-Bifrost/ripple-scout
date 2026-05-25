import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Integration suite: these tests DO connect to the local Postgres.
// Unlike vitest.config.ts (pure-logic, fake DATABASE_URL, nothing connects),
// this config loads the real `.env` via dotenv so Prisma talks to the dev DB.
// Tests must use uniquely-prefixed synthetic ids and clean up after themselves —
// they run against real data and must never wipe it.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    setupFiles: ["dotenv/config"],
    // Real DB round-trips; keep these serial and give them room.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
