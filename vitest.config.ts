import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Pure-logic tests never query the DB, but importing modules that
    // construct PrismaClient requires a URL whose scheme matches the schema
    // provider (postgresql). Nothing connects to this.
    env: {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/unused",
    },
  },
});
