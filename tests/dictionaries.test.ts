import { expect, it } from "vitest";
import ru from "../dictionaries/ru.json";
import en from "../dictionaries/en.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, next]) => keys(next, prefix ? `${prefix}.${key}` : key));
}

it("both dictionaries have exactly the same non-empty message keys", () => {
  expect(keys(ru).sort()).toEqual(keys(en).sort());
  function check(value: unknown) {
    if (typeof value === "string") expect(value.trim()).not.toBe("");
    else for (const next of Object.values(value as Record<string, unknown>)) check(next);
  }
  check(ru); check(en);
});
