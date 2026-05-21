"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) {
    return { error: "ADMIN_PASSWORD not set on server" };
  }
  if (password !== expected) {
    return { error: "Incorrect password" };
  }

  const session = await getSession();
  session.loggedIn = true;
  await session.save();

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();
  redirect("/login");
}
