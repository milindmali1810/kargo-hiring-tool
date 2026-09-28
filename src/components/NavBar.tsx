"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/", label: "Shortlist" },
  { href: "/candidates/new", label: "Add candidate" },
  { href: "/calibration", label: "Calibration" },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (pathname.startsWith("/login")) return null;

  return (
    <nav className="border-b border-[var(--color-border)] bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-7">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-orange-500 text-sm font-bold text-white shadow-sm">
              K
            </span>
            <span className="font-heading text-sm font-semibold text-slate-900">Kargo Hiring Tool</span>
          </Link>
          <div className="flex gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
        <button
          onClick={signOut}
          className="rounded-full px-3 py-1.5 text-sm text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-slate-800"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
