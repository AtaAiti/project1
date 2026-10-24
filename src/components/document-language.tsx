"use client";
import { useEffect } from "react";
import type { Locale } from "@/lib/dictionaries";
/** Keep the shared root document in sync during client-side language changes. */
export function DocumentLanguage({ locale }: { locale: Locale }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}
