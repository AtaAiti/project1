import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, expect, it } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
  await db.exec(await readFile(new URL("../supabase/migrations/20261013000100_0001_baseline.sql", import.meta.url), "utf8"));
  await db.exec("insert into menu_items(category,name_ru,name_en) values('Десерты','Dessert','Dessert'),('Кофе','Coffee','Coffee')");
  const sql = await readFile(new URL("../supabase/migrations/20261022000100_0005_menu_photos.sql", import.meta.url), "utf8");
  await db.exec(sql);
  await db.exec("update menu_items set image_url='https://example.com/custom.jpg' where category='Кофе'");
  await db.exec(sql);
}, 30000);
afterAll(async () => { await db?.close(); });
it("backfills category illustrations and preserves uploaded photos on reapplication", async () => {
  const { rows } = await db.query<{ category: string; image_url: string }>("select category,image_url from menu_items order by category");
  expect(rows.find(row => row.category === 'Десерты')?.image_url).toBe('/images/stock/dessert.jpg');
  expect(rows.find(row => row.category === 'Кофе')?.image_url).toBe('https://example.com/custom.jpg');
});
it("rejects unsafe paths and keeps RLS enabled", async () => {
  await expect(db.exec("update menu_items set image_url='javascript:alert(1)' ")).rejects.toThrow();
  await expect(db.exec("update menu_items set image_url='/private/file.jpg' ")).rejects.toThrow();
  expect((await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname='menu_items'")).rows[0].relrowsecurity).toBe(true);
});
