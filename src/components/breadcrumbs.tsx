"use client";
import Link from "@/components/feedback-link";
import { usePathname } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
export function Breadcrumbs({ locale }: { locale: string }) {
  const pathname = usePathname(),
    d = getDictionary(locale),
    parts = pathname.split("/").filter(Boolean),
    section = parts[1];
  if (!section) return null;
  const label = d.nav[section as keyof typeof d.nav];
  if (!label) return null;
  return (
    <nav
      aria-label={d.experience.location}
      className="border-b border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-3 text-sm text-[var(--text-secondary)] md:px-12"
    >
      <ol className="flex flex-wrap items-center gap-3">
        <li>
          <Link href={`/${locale}`} className="hover:text-[var(--gold)]">
            {d.nav.home}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          {parts[2] ? (
            <Link href={`/${locale}/${section}`}>{label}</Link>
          ) : (
            <span aria-current="page" className="text-[var(--text-primary)]">
              {label}
            </span>
          )}
        </li>
        {parts[2] && (
          <>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[var(--text-primary)]">
              {d.rsvp.title}
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}
