import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "vitest";
import { BOOKING_ERROR_KEYS } from "../src/lib/booking-errors.ts";

async function readDictionary(locale) {
  return JSON.parse(await readFile(new URL(`../dictionaries/${locale}.json`, import.meta.url), "utf8"));
}

test("every booking API error key exists in both dictionaries", async () => {
  const dictionaries = await Promise.all([readDictionary("ru"), readDictionary("en")]);

  for (const errorKey of BOOKING_ERROR_KEYS) {
    for (const dictionary of dictionaries) {
      assert.equal(typeof dictionary.errors?.[errorKey], "string", `Missing dictionary entry for ${errorKey}`);
      assert.notEqual(dictionary.errors[errorKey].trim(), "", `Empty dictionary entry for ${errorKey}`);
    }
  }
});
