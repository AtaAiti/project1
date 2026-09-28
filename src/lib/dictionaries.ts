import ru from "../../dictionaries/ru.json";
import en from "../../dictionaries/en.json";

export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];
export const dictionaries = { ru, en } as const;
export function getDictionary(locale: string) {
  return dictionaries[locales.includes(locale as Locale) ? (locale as Locale) : "ru"];
}
