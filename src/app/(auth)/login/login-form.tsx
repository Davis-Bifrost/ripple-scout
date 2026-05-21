"use client";

import { useTransition, useState } from "react";
import { loginAction } from "@/app/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const res = await loginAction(fd);
          if (res?.error) setError(res.error);
        });
      }}
      className="space-y-3"
    >
      <input type="hidden" name="next" value={next ?? ""} />
      <label className="block">
        <span className="block text-sm mb-1">Password</span>
        <input
          name="password"
          type="password"
          required
          autoFocus
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
