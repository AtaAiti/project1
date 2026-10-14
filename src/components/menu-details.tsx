import type { MenuItem } from "@/lib/content";
import { getDictionary } from "@/lib/dictionaries";
export function MenuDetails({
  item,
  locale,
}: {
  item: MenuItem;
  locale: string;
}) {
  const d = getDictionary(locale),
    t = d.experience,
    portion = locale === "en" ? item.portion_en : item.portion_ru;
  return (
    <div className="mt-4 flex flex-wrap gap-2 text-xs leading-5">
      {item.strength && (
        <span className="detail-chip">
          <span className="text-[var(--text-secondary)]">{t.strength}</span>
          <strong>{item.strength}</strong>
        </span>
      )}
      {portion && (
        <span className="detail-chip">
          <span className="text-[var(--text-secondary)]">{t.portion}</span>
          <strong>{portion}</strong>
        </span>
      )}
      {item.is_hit && (
        <span className="detail-chip text-[var(--gold)]">
          ✦ {d.publicUi.hit}
        </span>
      )}
    </div>
  );
}
