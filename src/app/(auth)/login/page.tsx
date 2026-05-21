import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  if (await isLoggedIn()) redirect(sp.next || "/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm border rounded-lg p-6 bg-card shadow-sm">
        <h1 className="text-xl font-semibold mb-1">Ripple Scout</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Internal sign-in
        </p>
        <LoginForm next={sp.next} />
      </div>
    </main>
  );
}
