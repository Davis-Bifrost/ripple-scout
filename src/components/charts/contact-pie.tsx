"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS: Record<string, string> = {
  has_email: "#10b981",
  has_social_only: "#6366f1",
  needs_manual_check: "#f59e0b",
  no_contact: "#94a3b8",
};

const LABELS: Record<string, string> = {
  has_email: "Has email",
  has_social_only: "Social only",
  needs_manual_check: "Needs manual",
  no_contact: "No contact",
};

export function ContactPie({ data }: { data: { key: string; count: number }[] }) {
  if (!data.length) {
    return (
      <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
        No data
      </div>
    );
  }
  const named = data.map((d) => ({ ...d, label: LABELS[d.key] ?? d.key }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={named}
          dataKey="count"
          nameKey="label"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
        >
          {named.map((d) => (
            <Cell key={d.key} fill={COLORS[d.key] ?? "#cbd5e1"} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
