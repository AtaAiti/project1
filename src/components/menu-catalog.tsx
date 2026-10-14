"use client";
import { useState } from "react";
import type { MenuItem } from "@/lib/content";
import { MENU_CATEGORIES, menuImage } from "@/lib/menu-presentation";
import { getDictionary } from "@/lib/dictionaries";
import { ContentImage } from "@/components/content-image";
import { MenuDetails } from "@/components/menu-details";
export function MenuCatalog({
  items,
  locale,
}: {
  items: MenuItem[];
  locale: string;
}) {
  const d = getDictionary(locale),
    t = d.experience,
    labels = d.publicUi.categoryLabels;
  const [selected, setSelected] = useState("");
  const categories = [...new Set(items.map((item) => item.category))].sort(
    (a, b) => {
      const ai = MENU_CATEGORIES.indexOf(a as (typeof MENU_CATEGORIES)[number]),
        bi = MENU_CATEGORIES.indexOf(b as (typeof MENU_CATEGORIES)[number]);
      return (ai < 0 ? 100 : ai) - (bi < 0 ? 100 : bi);
    },
  );
  const shown = selected ? [selected] : categories;
  const categoryLabel = (key: string) =>
    labels[key as keyof typeof labels] || key;
  return (
    <>
      <nav
        aria-label={t.categories}
        className="sticky top-24 z-20 -mx-2 mt-10 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/95 p-3 backdrop-blur"
      >
        <div className="flex flex-wrap gap-2">
          {["", ...categories].map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={selected === category}
              onClick={() => setSelected(category)}
              className={`min-h-11 rounded-full border px-4 py-2 text-sm ${selected === category ? "border-[var(--gold)] bg-[var(--gold)] font-bold text-[#210c14]" : "border-[var(--border)] text-[var(--text-primary)] hover:border-[var(--gold)]"}`}
            >
              {category ? categoryLabel(category) : t.all}
              <span className="ml-2 text-xs">
                {category
                  ? items.filter((item) => item.category === category).length
                  : items.length}
              </span>
            </button>
          ))}
        </div>
      </nav>
      <p role="status" className="mt-5 text-sm text-[var(--text-secondary)]">
        {selected ? categoryLabel(selected) : t.all} · {t.items}:{" "}
        {selected
          ? items.filter((item) => item.category === selected).length
          : items.length}
      </p>
      {!items.length && <p className="card mt-8 p-8">{d.publicUi.emptyMenu}</p>}
      {shown.map((category) => (
        <section key={category} className="mt-10 page-enter">
          <h2 className="display text-3xl">{categoryLabel(category)}</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items
              .filter((item) => item.category === category)
              .map((item) => (
                <article className="card overflow-hidden" key={item.id}>
                  <div className="relative aspect-[4/3]">
                    <ContentImage
                      src={menuImage(item)}
                      alt={locale === "en" ? item.name_en : item.name_ru}
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="display text-2xl">
                        {locale === "en" ? item.name_en : item.name_ru}
                      </h3>
                      <span className="whitespace-nowrap font-bold text-[var(--gold)]">
                        {item.price} {d.publicUi.currency}
                      </span>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">
                      {locale === "en"
                        ? item.composition_en
                        : item.composition_ru}
                    </p>
                    <MenuDetails item={item} locale={locale} />
                  </div>
                </article>
              ))}
          </div>
        </section>
      ))}
    </>
  );
}
