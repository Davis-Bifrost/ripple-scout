/**
 * Exercise the Zod-backed parseSearchParams contract:
 * - well-formed input parses correctly
 * - malformed/unknown input collapses to safe defaults rather than throwing
 *
 * Run:  pnpm exec tsx scripts/verify-search-params.ts
 */
import { parseSearchParams } from "../src/lib/channels-query.ts";

type Case = {
  name: string;
  input: Record<string, string | string[] | undefined>;
  expect: (out: ReturnType<typeof parseSearchParams>) => boolean;
};

const cases: Case[] = [
  {
    name: "empty",
    input: {},
    expect: (o) =>
      o.sort === "subs_desc" &&
      o.page === 1 &&
      o.pageSize === 50 &&
      Object.values(o.filters).every((v) => v === undefined),
  },
  {
    name: "well-formed",
    input: {
      q: "tech",
      country: "MY,SG",
      tier: "Mid-Tier",
      hasEmail: "true",
      sort: "views_desc",
      page: "3",
      pageSize: "100",
    },
    expect: (o) =>
      o.filters.q === "tech" &&
      o.filters.countries?.join(",") === "MY,SG" &&
      o.filters.tiers?.[0] === "Mid-Tier" &&
      o.filters.hasEmail === "true" &&
      o.sort === "views_desc" &&
      o.page === 3 &&
      o.pageSize === 100,
  },
  {
    name: "malformed hasEmail collapses to no-filter",
    input: { hasEmail: "BOGUS" },
    expect: (o) => o.filters.hasEmail === undefined,
  },
  {
    name: "malformed sort falls back to subs_desc",
    input: { sort: "DROP_TABLE" },
    expect: (o) => o.sort === "subs_desc",
  },
  {
    name: "malformed page falls back to 1",
    input: { page: "abc" },
    expect: (o) => o.page === 1,
  },
  {
    name: "pageSize over cap clamps",
    input: { pageSize: "9999" },
    expect: (o) => o.pageSize === 50,
  },
  {
    name: "q over length collapses filters",
    input: { q: "x".repeat(500) },
    expect: (o) => o.filters.q === undefined,
  },
  {
    name: "too-long country dropped",
    input: { country: "this-is-not-a-country-code" },
    expect: (o) => o.filters.countries === undefined,
  },
];

let pass = 0;
let fail = 0;
for (const c of cases) {
  const out = parseSearchParams(c.input);
  const ok = c.expect(out);
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}`);
  if (!ok) {
    console.log("  out:", JSON.stringify(out));
    fail++;
  } else {
    pass++;
  }
}

console.log(`\n${pass}/${cases.length} passed`);
if (fail > 0) process.exit(1);
