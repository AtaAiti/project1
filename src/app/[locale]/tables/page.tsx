import { localizedMetadata } from "@/lib/site-seo";
import { getDictionary } from "@/lib/dictionaries";
import { findVenueTable } from "@/lib/venue-tables";
import { TablePicker } from "@/components/table-picker";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/tables">) {
  const { locale } = await params;
  return localizedMetadata(locale === "en" ? "en" : "ru", "tables");
}

export default async function TablesPage({
  params,
  searchParams,
}: PageProps<"/[locale]/tables">) {
  const { locale } = await params;
  const query = await searchParams;
  const initialTableId = findVenueTable(query.table)?.id;
  const t = getDictionary(locale).tables;
  return (
    <main lang={locale} className="mx-auto max-w-6xl px-6 py-12">
      <p className="section-label">{t.eyebrow}</p>
      <h1 className="display mt-5 text-5xl">{t.title}</h1>
      <p className="mt-5 max-w-2xl leading-7 text-[var(--text-secondary)]">
        {t.intro}
      </p>
      <TablePicker
        key={initialTableId || "choose"}
        locale={locale}
        initialTableId={initialTableId}
      />
    </main>
  );
}
