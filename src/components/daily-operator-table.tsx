"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/utils";

type Row = {
  day: string;
  operator: string;
  observations: number;
  uniqueChannels: number;
  withEmail: number;
};

type Metric = "observations" | "uniqueChannels" | "withEmail";

const METRIC_LABELS: Record<Metric, string> = {
  observations: "Observations",
  uniqueChannels: "Unique channels",
  withEmail: "With email",
};

// Channel-grain metrics — a channel can appear in multiple (day, operator)
// cells, so cell sums double-count. When provided, the footer uses true
// distinct totals for these metrics instead.
const DISTINCT_METRICS: ReadonlyArray<Metric> = ["uniqueChannels", "withEmail"];

export type OperatorTotals = Partial<
  Record<Metric, number | null | undefined>
>;

type SortKey = "day" | "total" | string; // string = operator name (column)
type SortDir = "asc" | "desc";

export function DailyOperatorTable({
  rows,
  operatorTotals,
  globalTotals,
}: {
  rows: Row[];
  operatorTotals?: Record<string, OperatorTotals>;
  globalTotals?: OperatorTotals;
}) {
  const [metric, setMetric] = useState<Metric>("observations");
  const [sortKey, setSortKey] = useState<SortKey>("day");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { operators, days, cells, perDayTotal, perOperatorTotal } = useMemo(() => {
    const operators = Array.from(new Set(rows.map((r) => r.operator))).sort();
    const days = Array.from(new Set(rows.map((r) => r.day))).sort();
    const cells = new Map<string, number>();
    for (const r of rows) cells.set(`${r.day}|${r.operator}`, r[metric]);

    const perDayTotal = new Map<string, number>();
    const perOperatorTotal = new Map<string, number>();
    for (const day of days) {
      let sum = 0;
      for (const op of operators) {
        const v = cells.get(`${day}|${op}`) ?? 0;
        sum += v;
        perOperatorTotal.set(op, (perOperatorTotal.get(op) ?? 0) + v);
      }
      perDayTotal.set(day, sum);
    }
    return { operators, days, cells, perDayTotal, perOperatorTotal };
  }, [rows, metric]);

  const sortedDays = useMemo(() => {
    const arr = [...days];
    arr.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (sortKey === "day") {
        av = a;
        bv = b;
      } else if (sortKey === "total") {
        av = perDayTotal.get(a) ?? 0;
        bv = perDayTotal.get(b) ?? 0;
      } else {
        av = cells.get(`${a}|${sortKey}`) ?? 0;
        bv = cells.get(`${b}|${sortKey}`) ?? 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [days, sortKey, sortDir, cells, perDayTotal]);

  function click(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "day" ? "desc" : "desc");
    }
  }

  function arrow(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  if (!operators.length) {
    return (
      <div className="text-sm text-muted-foreground p-4">
        No daily activity to show.
      </div>
    );
  }

  const cellSumGrandTotal = Array.from(perOperatorTotal.values()).reduce(
    (a, b) => a + b,
    0,
  );
  const isDistinctMetric = DISTINCT_METRICS.includes(metric);
  const grandTotal =
    isDistinctMetric && globalTotals && typeof globalTotals[metric] === "number"
      ? (globalTotals[metric] as number)
      : cellSumGrandTotal;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-4 pt-3">
        <span className="text-xs text-muted-foreground">Metric:</span>
        {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={`text-xs rounded-md px-2 py-1 border ${
              metric === m
                ? "bg-primary text-primary-foreground border-primary"
                : "hover:bg-muted"
            }`}
          >
            {METRIC_LABELS[m]}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          Click any column header to sort.
        </span>
      </div>
      {isDistinctMetric && (operatorTotals || globalTotals) && (
        <p className="px-4 text-[11px] text-muted-foreground">
          Per-day cells dedupe within (day × operator); footer totals dedupe
          globally per operator and overall — so footer totals can be lower
          than the sum of the column.
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="text-left">
              <Th onClick={() => click("day")}>Day{arrow("day")}</Th>
              {operators.map((op) => (
                <Th key={op} className="text-right" onClick={() => click(op)}>
                  <span className="capitalize">{op}</span>
                  {arrow(op)}
                </Th>
              ))}
              <Th className="text-right" onClick={() => click("total")}>
                Total{arrow("total")}
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sortedDays.map((day) => (
              <tr key={day} className="hover:bg-muted/30">
                <td className="px-3 py-2 tabular-nums">{day}</td>
                {operators.map((op) => {
                  const v = cells.get(`${day}|${op}`) ?? 0;
                  return (
                    <td
                      key={op}
                      className={`px-3 py-2 text-right tabular-nums ${
                        v === 0 ? "text-muted-foreground" : ""
                      }`}
                    >
                      {v === 0 ? "—" : formatNumber(v)}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {formatNumber(perDayTotal.get(day) ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/30">
            <tr>
              <td className="px-3 py-2 text-xs uppercase text-muted-foreground">
                Total
              </td>
              {operators.map((op) => {
                const distinct =
                  isDistinctMetric &&
                  operatorTotals?.[op] &&
                  typeof operatorTotals[op][metric] === "number"
                    ? (operatorTotals[op][metric] as number)
                    : null;
                const value = distinct ?? (perOperatorTotal.get(op) ?? 0);
                return (
                  <td
                    key={op}
                    className="px-3 py-2 text-right tabular-nums font-medium"
                  >
                    {formatNumber(value)}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                {formatNumber(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground ${className}`}
    >
      {children}
    </th>
  );
}
