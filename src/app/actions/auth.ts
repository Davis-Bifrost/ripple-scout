"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { actionLogger } from "@/lib/logger";

const log = actionLogger("auth");

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type Bucket = { firstAttempt: number; failures: number; lockedUntil: number };

// In-memory, single-process. Sufficient for an internal-tool deployment;
// would need Redis (or a DB-backed table) for multi-instance.
const buckets = new Map<string, Bucket>();

function ipKey(h: Headers): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "local"
  );
}

function checkRate(
  key: string,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b) return { ok: true };
  if (b.lockedUntil > now) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((b.lockedUntil - now) / 1000),
    };
  }
  if (now - b.firstAttempt > WINDOW_MS) {
    buckets.delete(key);
  }
  return { ok: true };
}

function noteFailure(key: string) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b) {
    buckets.set(key, { firstAttempt: now, failures: 1, lockedUntil: 0 });
    return;
  }
  b.failures += 1;
  if (b.failures >= MAX_ATTEMPTS) {
    b.lockedUntil = now + LOCKOUT_MS;
  }
}

function safeEqual(a: string, b: string): boolean {
  // Hash both sides to a fixed length so timingSafeEqual never throws on
  // mismatched input length (which would itself leak the expected length).
  const ah = crypto.createHash("sha256").update(a).digest();
  const bh = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ah, bh);
}

export async function loginAction(
  formData: FormData,
): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) {
    return { error: "ADMIN_PASSWORD not set on server" };
  }

  const h = await headers();
  const key = ipKey(h);

  const rate = checkRate(key);
  if (!rate.ok) {
    log.warn({ ip: key, retryAfterSec: rate.retryAfterSec }, "login_rate_limited");
    const mins = Math.max(1, Math.ceil(rate.retryAfterSec / 60));
    return { error: `Too many attempts. Try again in ${mins} min.` };
  }

  if (!safeEqual(password, expected)) {
    noteFailure(key);
    log.warn({ ip: key }, "login_failed");
    return { error: "Incorrect password" };
  }

  buckets.delete(key);
  log.info({ ip: key }, "login_success");

  const session = await getSession();
  session.loggedIn = true;
  await session.save();

  // Reject external + protocol-relative redirects (//evil.com starts with /).
  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  redirect(safeNext);
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  log.info("logout");
  redirect("/login");
}
