"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";

const STORAGE_KEY = "literator-consent-v1";
type Choice = { version: 1; externalMedia: boolean };
type Consent = {
  ready: boolean;
  choice: Choice | null;
  settingsOpen: boolean;
  choose: (externalMedia: boolean) => void;
  openSettings: () => void;
};
const Context = createContext<Consent | null>(null);

function readChoice(): Choice | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return value?.version === 1 && typeof value.externalMedia === "boolean" ? value : null;
  } catch { return null; }
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => { setChoice(readChoice()); setReady(true); });
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setChoice(readChoice());
    };
    window.addEventListener("storage", sync);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("storage", sync); };
  }, []);
  function choose(externalMedia: boolean) {
    const value: Choice = { version: 1, externalMedia };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* Session-only choice when storage is unavailable. */ }
    setChoice(value);
    setSettingsOpen(false);
  }
  return <Context.Provider value={{ ready, choice, settingsOpen, choose, openSettings: () => setSettingsOpen(true) }}>{children}</Context.Provider>;
}

export function useConsent() {
  const context = useContext(Context);
  if (!context) throw new Error("ConsentProvider is required");
  return context;
}

export function CookieSettings({ locale }: { locale: string }) {
  const { openSettings, ready } = useConsent();
  return <button type="button" disabled={!ready} onClick={openSettings} className="min-h-11 text-left text-sm text-[var(--text-secondary)] underline underline-offset-4">{getDictionary(locale).cookies.settings}</button>;
}

export function CookieBanner({ locale }: { locale: string }) {
  const { ready, choice, settingsOpen, choose } = useConsent();
  const t = getDictionary(locale).cookies;
  if (!ready || (choice && !settingsOpen)) return null;
  return (
    <section lang={locale} role="region" aria-label={t.title} className="fixed inset-x-3 bottom-3 z-[45] mx-auto max-h-[70dvh] max-w-4xl overflow-y-auto rounded-xl border border-[var(--gold-border)] bg-[var(--bg-card)] p-5 shadow-2xl md:p-6">
      <h2 className="display text-xl">{t.title}</h2>
      <details className="mt-2 md:hidden">
        <summary className="min-h-11 cursor-pointer py-3 text-sm text-[var(--gold)] underline underline-offset-4">{t.details}</summary>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">{t.description}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{t.storage}</p>
      </details>
      <div className="hidden md:block">
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{t.description}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">{t.storage}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="btn-outline-gold" onClick={() => choose(false)}>{t.necessary}</button>
        <button type="button" className="btn-gold" onClick={() => choose(true)}>{t.allowMap}</button>
      </div>
    </section>
  );
}
