"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function BarByKey({
  data,
  xKey = "key",
  yKey = "count",
  color = "#6366f1",
  height = 240,
}: {
  data: { key: string; count: number }[];
  xKey?: string;
  yKey?: string;
  color?: string;
  height?: number;
}) {
  if (!data.length) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center text-sm text-muted-foreground"
      >
        No data
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid stroke="#e5e7eb" vertical={false} />
        <XAxis
          dataKey={xKey}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
          interval={0}
          angle={-30}
          dy={6}
          height={50}
        />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            padding: "6px 8px",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
          }}
        />
        <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
