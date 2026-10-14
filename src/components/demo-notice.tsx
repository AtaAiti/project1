import { getDictionary } from "@/lib/dictionaries";

export function DemoNotice({ locale }: { locale: string }) {
  const t = getDictionary(locale).publicUi;
  return (
    <aside className="border-b border-[var(--border)] bg-[var(--bg-secondary)] px-6 py-3 text-center text-sm">
      <strong className="text-[var(--gold)]">{t.demo}</strong>
      <span className="ml-2 text-[var(--text-secondary)]">{t.demoNote}</span>
    </aside>
  );
}
