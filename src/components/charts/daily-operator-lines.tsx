"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#14b8a6", "#ec4899", "#3b82f6", "#84cc16", "#f97316",
  "#06b6d4", "#a855f7",
];

export function DailyOperatorLines({
  rows,
  metric = "observations",
}: {
  rows: { day: string; operator: string; observations: number; uniqueChannels: number; withEmail: number }[];
  metric?: "observations" | "uniqueChannels" | "withEmail";
}) {
  if (!rows.length) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
        No daily activity yet.
      </div>
    );
  }

  const operators = Array.from(new Set(rows.map((r) => r.operator))).sort();
  const days = Array.from(new Set(rows.map((r) => r.day))).sort();
  const byKey = new Map<string, number>();
  for (const r of rows) byKey.set(`${r.day}|${r.operator}`, r[metric]);

  const data = days.map((day) => {
    const row: Record<string, string | number> = { day };
    for (const op of operators) row[op] = byKey.get(`${day}|${op}`) ?? 0;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="day" fontSize={11} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
        <YAxis fontSize={11} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {operators.map((op, i) => (
          <Line
            key={op}
            type="monotone"
            dataKey={op}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
