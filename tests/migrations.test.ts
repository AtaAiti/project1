import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
let foundation: string;
beforeAll(async () => {
  db = new PGlite();
  // Minimal Supabase-managed schemas in an isolated PostgreSQL WASM instance.
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
  `);
  const baseline = await readFile(new URL("../supabase/migrations/20261013000100_0001_baseline.sql", import.meta.url), "utf8");
  foundation = await readFile(new URL("../supabase/migrations/20261013000200_0002_foundation.sql", import.meta.url), "utf8");
  await db.exec(baseline);
  await db.exec(baseline);
  await db.exec("insert into public.bookings (name, phone, date, time, guests) values ('legacy', '+996700123456', '2026-11-01', '19:00', 1)");
  await db.exec(foundation);
}, 30000);
afterAll(async () => { await db?.close(); });

it("backfills legacy statuses and enforces the new status contract", async () => {
  expect((await db.query<{ status: string }>("select status from public.bookings where name = 'legacy'")).rows[0].status).toBe("pending");
  await expect(db.exec("update public.bookings set status='new'")).rejects.toThrow();
  await db.exec("update public.bookings set status='confirmed' where name='legacy'");
  await db.exec(foundation);
  expect((await db.query<{ status: string }>("select status from public.bookings where name = 'legacy'")).rows[0].status).toBe("confirmed");
});

it("atomically increments the limit and rejects the sixth request", async () => {
  const results = [];
  for (let i = 0; i < 6; i++) results.push((await db.query<{ allowed: boolean }>("select public.check_rate_limit('test-key',5,600) as allowed")).rows[0].allowed);
  expect(results).toEqual([true, true, true, true, true, false]);
});

it("cleans expired rows and resets an expired window", async () => {
  await db.exec("insert into public.rate_limits values ('expired',9,now()-interval '20 minutes',now()-interval '10 minutes')");
  expect((await db.query<{ allowed: boolean }>("select public.check_rate_limit('expired',5,600) as allowed")).rows[0].allowed).toBe(true);
  expect((await db.query<{ request_count: number }>("select request_count from public.rate_limits where key_hash='expired'")).rows[0].request_count).toBe(1);
});

it("only service_role can execute RPC and public sessions cannot write bookings", async () => {
  for (const role of ["anon", "authenticated"]) {
    expect((await db.query<{ allowed: boolean }>(`select has_function_privilege('${role}', 'public.check_rate_limit(text, integer, integer)', 'execute') as allowed`)).rows[0].allowed).toBe(false);
    expect((await db.query<{ allowed: boolean }>(`select has_table_privilege('${role}', 'public.bookings', 'insert') as allowed`)).rows[0].allowed).toBe(false);
  }
  expect((await db.query<{ allowed: boolean }>("select has_function_privilege('service_role', 'public.check_rate_limit(text, integer, integer)', 'execute') as allowed")).rows[0].allowed).toBe(true);
});

it("media is public-read with bounded images and server-only write policies", async () => {
  const bucket = (await db.query<{ public: boolean; file_size_limit: number }>("select * from storage.buckets where id='media'")).rows[0];
  expect(bucket.public).toBe(true);
  expect(Number(bucket.file_size_limit)).toBe(5242880);
  const policies = (await db.query<{ cmd: string; roles: string[] }>("select cmd, roles from pg_policies where schemaname='storage' and tablename='objects' and cmd != 'SELECT'")).rows;
  expect(policies).toHaveLength(3);
  for (const policy of policies) expect(policy.roles).toEqual(["service_role"]);
});
