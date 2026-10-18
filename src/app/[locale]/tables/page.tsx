import { getDictionary } from "@/lib/dictionaries";
import { TablePicker } from "@/components/table-picker";

export default async function TablesPage({ params }: PageProps<"/[locale]/tables">) {
  const { locale } = await params;
  const t = getDictionary(locale).tables;
  return <main lang={locale} className="mx-auto max-w-6xl px-6 py-12"><p className="section-label">{t.eyebrow}</p><h1 className="display mt-5 text-5xl">{t.title}</h1><p className="mt-5 max-w-2xl leading-7 text-[var(--text-secondary)]">{t.intro}</p><TablePicker locale={locale} /></main>;
}
