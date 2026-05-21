import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/batches", label: "Batches" },
  { href: "/channels", label: "Channels" },
  { href: "/markets/MY", label: "Markets" },
];

export function Nav() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto max-w-7xl px-6 h-14 flex items-center gap-6">
        <Link href="/dashboard" className="font-semibold text-sm">
          Ripple Scout
        </Link>
        <nav className="flex gap-4 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto">
          <form action={logoutAction}>
            <button
              type="submit"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
