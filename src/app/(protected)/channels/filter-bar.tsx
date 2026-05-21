"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { MultiSelect } from "@/components/multi-select";
import { formatCountry } from "@/lib/utils";

const TIERS = ["New", "Nano", "Micro", "Mid-Tier", "Macro", "Mega"];
const CONTACT_OPTIONS = [
  { value: "", label: "Any contact" },
  { value: "has_email", label: "Has email" },
  { value: "has_social_only", label: "Social only" },
  { value: "needs_manual_check", label: "Needs manual" },
  { value: "no_contact", label: "No contact" },
];
const SORT_OPTIONS = [
  { value: "subs_desc", label: "Subscribers ↓" },
  { value: "subs_asc", label: "Subscribers ↑" },
  { value: "views_desc", label: "Views ↓" },
  { value: "views_asc", label: "Views ↑" },
  { value: "engagement_desc", label: "Engagement ↓" },
  { value: "joined_desc", label: "Joined ↓" },
  { value: "lastSeen_desc", label: "Last seen ↓" },
];

export function FilterBar({
  countries,
  keywords,
  operators,
}: {
  countries: string[];
  keywords: string[];
  operators: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(sp.get("q") ?? "");

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.push(`/channels?${next.toString()}`));
  }

  function exportUrl() {
    const next = new URLSearchParams(sp);
    return `/api/export?${next.toString()}`;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q });
          }}
          className="flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, handle, channel id, description…"
            className="rounded-md border bg-background px-3 py-1.5 text-sm w-[320px]"
          />
          <button type="submit" className="text-sm rounded-md border px-3 py-1.5 hover:bg-muted">
            Search
          </button>
        </form>

        <MultiSelect
          placeholder="Country"
          options={countries
            .map((c) => ({ value: c, label: formatCountry(c) }))
            .sort((a, b) => a.label.localeCompare(b.label))}
          values={(sp.get("country") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)}
          onChange={(next) =>
            update({ country: next.length ? next.join(",") : undefined })
          }
          searchable
          width={260}
        />

        <MultiSelect
          placeholder="Tier"
          options={TIERS.map((t) => ({ value: t, label: t }))}
          values={(sp.get("tier") ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)}
          onChange={(next) =>
            update({ tier: next.length ? next.join(",") : undefined })
          }
        />

        <Select
          value={sp.get("contactStatus") ?? ""}
          onChange={(v) => update({ contactStatus: v })}
          options={CONTACT_OPTIONS}
          placeholder="Contact"
        />

        <Select
          value={sp.get("hasEmail") ?? ""}
          onChange={(v) => update({ hasEmail: v })}
          options={[
            { value: "", label: "Any email" },
            { value: "true", label: "Has email" },
            { value: "false", label: "No email" },
          ]}
          placeholder="Email"
        />

        <Select
          value={sp.get("searchKeyword") ?? ""}
          onChange={(v) => update({ searchKeyword: v })}
          options={[
            { value: "", label: "Any keyword" },
            ...keywords.map((k) => ({ value: k, label: k })),
          ]}
          placeholder="Keyword"
        />

        <Select
          value={sp.get("operator") ?? ""}
          onChange={(v) => update({ operator: v })}
          options={[
            { value: "", label: "Any operator" },
            ...operators.map((o) => ({ value: o, label: o })),
          ]}
          placeholder="Operator"
        />

        <Select
          value={sp.get("sort") ?? "subs_desc"}
          onChange={(v) => update({ sort: v })}
          options={SORT_OPTIONS}
          placeholder="Sort"
        />

        <a
          href={exportUrl()}
          className="ml-auto text-sm rounded-md border px-3 py-1.5 hover:bg-muted"
        >
          Export CSV
        </a>
      </div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border bg-background px-2 py-1.5 text-sm"
      aria-label={placeholder}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
