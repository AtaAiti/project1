"use client";

import Link from "@/components/feedback-link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getDictionary } from "@/lib/dictionaries";

const d = getDictionary("ru");
const t = d.admin;
const x = d.adminExtra;
const items = [
  ["/admin", t.overview],
  ["/admin/menu", t.menu],
  ["/admin/events", t.events],
  ["/admin/gallery", t.gallery],
  ["/admin/reviews", t.reviews],
  ["/admin/bookings", x.bookings],
  ["/admin/telegram", d.telegramAdmin.title],
] as const;

export default function AdminShell({
  children,
  canManageTeam = false,
}: {
  children: React.ReactNode;
  canManageTeam?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      router.replace("/ru");
      router.refresh();
    } catch {
      setError(x.logoutFailed);
    } finally {
      setBusy(false);
    }
  }
  const navigation = (
    <nav className="flex gap-2 overflow-x-auto md:flex-col">
      {(canManageTeam
        ? [...items, ["/admin/team", d.team.title] as const]
        : items
      ).map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            pathname === href ||
            (href !== "/admin" && pathname.startsWith(href + "/"))
              ? "page"
              : undefined
          }
          className={`whitespace-nowrap rounded px-3 py-3 text-sm ${pathname === href || (href !== "/admin" && pathname.startsWith(href + "/")) ? "bg-[var(--gold)]/20 text-[var(--gold)]" : "text-[var(--text-primary)]"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)] p-5 md:flex">
        <Link href="/admin" className="display mb-8 text-2xl">
          ЛИТЕРАТОРЪ
        </Link>
        {navigation}
        <div className="mt-auto grid gap-4 border-t border-[var(--border)] pt-5">
          <Link className="text-sm text-[var(--gold)]" href="/ru">
            {x.visitorSite}
          </Link>
          <button
            className="text-left text-sm"
            disabled={busy}
            onClick={logout}
          >
            {x.logout}
          </button>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
        </div>
      </aside>
      <div className="md:hidden border-b border-[var(--border)] bg-[var(--bg-secondary)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/ru" className="text-sm text-[var(--gold)]">
            {x.visitorSite}
          </Link>
          <button disabled={busy} onClick={logout} className="text-sm">
            {x.logout}
          </button>
        </div>
        {navigation}
        {error && (
          <p role="alert" className="mt-3 text-sm">
            {error}
          </p>
        )}
      </div>
      <div className="md:ml-60">{children}</div>
    </div>
  );
}
