import { notFound } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";

const sections = ["about", "menu", "afisha", "contacts"];

export default async function SectionPage({ params }: PageProps<"/[locale]/[section]">) {
  const { locale, section } = await params;
  if (!sections.includes(section)) notFound();
  const t = getDictionary(locale);
  const label = t.nav[section as keyof typeof t.nav];
  return <main className="flex min-h-[calc(100vh-91px)] items-center px-6 py-20 md:px-16"><div className="max-w-3xl"><p className="mb-7 text-[10px] uppercase tracking-[0.3em] text-[var(--wine-bright)]">{label} / {t.placeholder.eyebrow}</p><h1 className="display text-6xl leading-[.92] tracking-[-.05em] md:text-8xl">{label}</h1><p className="mt-8 max-w-md text-sm leading-7 text-[var(--muted)]">{t.placeholder.text}</p><div className="mt-14 h-px w-32 bg-[var(--wine-bright)]" /></div></main>;
}
