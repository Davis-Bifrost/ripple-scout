"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type MultiSelectOption = { value: string; label: string };

export function MultiSelect({
  placeholder,
  options,
  values,
  onChange,
  searchable = false,
  width = 220,
}: {
  placeholder: string;
  options: MultiSelectOption[];
  values: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onDoc);
      if (searchable) {
        // autofocus the search input when opening
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    } else {
      setQuery("");
    }
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, searchable]);

  const selectedSet = useMemo(() => new Set(values), [values]);
  const labelByValue = useMemo(
    () => new Map(options.map((o) => [o.value, o.label])),
    [options],
  );

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query, searchable]);

  const buttonLabel =
    values.length === 0
      ? `Any ${placeholder.toLowerCase()}`
      : values.length === 1
        ? (labelByValue.get(values[0]) ?? values[0])
        : `${placeholder} (${values.length})`;

  function toggle(v: string) {
    if (selectedSet.has(v)) onChange(values.filter((x) => x !== v));
    else onChange([...values, v]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border bg-background px-2 py-1.5 text-sm flex items-center gap-1.5"
        style={{ minWidth: 120 }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={values.length === 0 ? "text-muted-foreground" : ""}>
          {buttonLabel}
        </span>
        <span className="ml-auto text-muted-foreground text-xs">▾</span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 rounded-md border bg-card shadow-md text-sm"
          style={{ width }}
        >
          {searchable && (
            <div className="p-1.5 border-b">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${placeholder.toLowerCase()}…`}
                className="w-full rounded border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          {values.length > 0 && (
            <div className="flex items-center justify-between px-2 py-1.5 border-b">
              <span className="text-xs text-muted-foreground">
                {values.length} selected
              </span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}

          <div className="max-h-[260px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-2 text-xs text-muted-foreground">
                No matches.
              </div>
            ) : (
              filtered.map((opt) => {
                const checked = selectedSet.has(opt.value);
                return (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(opt.value)}
                      className="h-3.5 w-3.5"
                    />
                    <span className="truncate">{opt.label}</span>
                    {opt.value !== opt.label && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {opt.value}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
