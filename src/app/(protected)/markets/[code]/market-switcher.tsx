"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { formatCountry } from "@/lib/utils";
import type { MarketScope } from "@/lib/stats/market";

export function MarketSwitcher({
  current,
  scope,
  markets,
}: {
  current: string;
  scope: MarketScope;
  markets: string[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function go(nextCode: string, nextScope: MarketScope) {
    startTransition(() =>
      router.push(`/markets/${nextCode}?scope=${nextScope}`),
    );
  }

  const sortedMarkets = [...markets].sort((a, b) =>
    formatCountry(a).localeCompare(formatCountry(b)),
  );

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      <select
        value={current}
        onChange={(e) => go(e.target.value, scope)}
        className="rounded-md border bg-background px-2 py-1.5 text-sm"
        aria-label="Switch market"
      >
        {sortedMarkets.map((m) => (
          <option key={m} value={m}>
            {formatCountry(m)} ({m})
          </option>
        ))}
      </select>
      <div className="inline-flex rounded-md border overflow-hidden text-xs">
        {(["based", "targeting", "either"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go(current, s)}
            className={`px-3 py-1.5 ${
              scope === s
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted"
            }`}
            aria-pressed={scope === s}
          >
            {s === "based" ? "Based" : s === "targeting" ? "Targeting" : "Either"}
          </button>
        ))}
      </div>
    </div>
  );
}
