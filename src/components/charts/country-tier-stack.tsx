"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const TIER_COLORS: Record<string, string> = {
  New: "#c7d2fe",
  Nano: "#a5b4fc",
  Micro: "#818cf8",
  "Mid-Tier": "#6366f1",
  Macro: "#4f46e5",
  Mega: "#3730a3",
  Unknown: "#cbd5e1",
};

const TIER_ORDER = ["New", "Nano", "Micro", "Mid-Tier", "Macro", "Mega", "Unknown"];

export function CountryTierStack({
  data,
}: {
  data: { country: string; tier: string; count: number }[];
}) {
  if (!data.length) {
    return (
      <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
        No data
      </div>
    );
  }

  const byCountry = new Map<string, Record<string, number>>();
  for (const r of data) {
    const c = byCountry.get(r.country) ?? {};
    c[r.tier] = r.count;
    byCountry.set(r.country, c);
  }
  const totals = Array.from(byCountry.entries())
    .map(([country, tiers]) => ({
      country,
      total: Object.values(tiers).reduce((a, b) => a + b, 0),
      ...tiers,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={totals} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey="country"
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {TIER_ORDER.map((tier) => (
          <Bar
            key={tier}
            dataKey={tier}
            stackId="a"
            fill={TIER_COLORS[tier]}
            radius={[0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
