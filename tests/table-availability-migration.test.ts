import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it } from "vitest";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key)");
  for (const file of ["20261013000100_0001_baseline.sql", "20261022000200_0006_telegram_bot.sql"]) {
    if (file.includes("telegram")) await db.exec("alter table bookings add column if not exists status text not null default 'pending'");
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  const migration = await readFile(new URL("../supabase/migrations/20261108000100_0007_table_availability.sql", import.meta.url), "utf8");
  await db.exec("insert into bookings(name,phone,date,time,guests,comment,status) values ('Legacy','+996700123456','2099-10-01','18:00',2,'Пожелание к бронированию: стол T8 (мест: 6, Рядом с баром)','pending')");
  await db.exec(migration); await db.exec(migration);
}, 30000);
afterAll(async () => { await db?.close(); });
it("preserves and accounts for existing table preferences", async () => {
  expect((await db.query<{ table_id: string }>("select table_id from bookings where name='Legacy'")).rows[0].table_id).toBe("T8");
  expect(await available("2099-10-01", "18:00")).not.toContain("T8");
});
async function insert(table: string, date: string, time: string, guests = 2) {
  return (await db.query<{ id: string }>("insert into bookings(name,phone,date,time,guests,table_id,status) values('Guest','+996700123456',$1,$2,$3,$4,'pending') returning id", [date, time, guests, table])).rows[0].id;
}
async function available(date: string, time: string) {
  return (await db.query<{ id: string }>("select * from available_venue_tables($1,$2,2)", [date, time])).rows.map((r) => r.id);
}
it("holds pending tables, handles overlap and allows adjacent visits", async () => {
  const id = await insert("T1", "2099-11-01", "18:00");
  expect(await available("2099-11-01", "17:30")).not.toContain("T1");
  expect(await available("2099-11-01", "19:30")).not.toContain("T1");
  expect(await available("2099-11-01", "20:00")).toContain("T1");
  expect(await available("2099-11-02", "18:00")).toContain("T1");
  await expect(insert("T1", "2099-11-01", "19:00")).rejects.toThrow("table_unavailable");
  await db.query("update bookings set status='declined' where id=$1", [id]);
  expect(await available("2099-11-01", "19:00")).toContain("T1");
  await insert("T1", "2099-11-01", "19:00");
  await expect(db.query("update bookings set status='confirmed' where id=$1", [id])).rejects.toThrow("table_unavailable");
});
it("enforces capacity, closing hours and hides guest details", async () => {
  await expect(insert("T2", "2099-11-01", "18:00", 3)).rejects.toThrow("table_capacity");
  await expect(insert("T2", "2099-11-01", "22:00")).rejects.toThrow("booking_hours");
  await insert("T2", "2099-11-01", "21:30");
  const rows = (await db.query<{ id: string }>("select * from available_venue_tables('2099-11-01','20:00',2)")).rows;
  expect(rows).not.toContainEqual({ id: "T2" });
  for (const row of rows) expect(Object.keys(row)).toEqual(["id"]);
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await expect(db.exec("select * from available_venue_tables('2099-11-01','18:00',2)")).rejects.toThrow();
    await db.exec("reset role");
  }
});
const finish = async (update: number, action: string, replies: object) => (await db.query<{ r: { outcome: string; duplicate: boolean } }>("select finish_telegram_update(10,$1,20,20,'en',$2::jsonb,$3) r", [update, JSON.stringify(replies), action])).rows[0].r;
const job = [{ method: "sendMessage", params: { chat_id: 20, text: "Saved" } }];
it("persists visitor state with replies; stale buttons cannot advance it", async () => {
  expect((await finish(100, "guest_flow", { expected_token: "", flow: { token: "a", step: "date" }, normal: job })).outcome).toBe("normal");
  expect((await finish(101, "guest_flow", { expected_token: "", flow: { token: "b" }, normal: job, stale: job })).outcome).toBe("stale");
  const session = (await db.query<{ flow: { token: string } }>("select flow from telegram_sessions where bot_id=10 and chat_id=20")).rows[0];
  expect(session.flow.token).toBe("a");
});
it("creates a visitor booking exactly once, with an atomic durable reply", async () => {
  await finish(102, "guest_flow", { expected_token: "a", flow: { token: "review", step: "review", expires: "2099-12-01T00:00:00Z" }, normal: [] });
  const booking = { id: "11111111-1111-4111-8111-111111111111", name: "Bot Guest", phone: "+996700123456", date: "2099-12-01", time: "18:00", guests: 2, table_id: "T3", comment: "Telegram" };
  const payload = { expected_token: "review", guest_booking: booking, normal: job, stale: job };
  expect((await finish(103, "guest_booking", payload)).outcome).toBe("normal");
  expect(await finish(103, "guest_booking", payload)).toEqual({ duplicate: true });
  expect((await db.query("select * from bookings where id=$1", [booking.id])).rows).toHaveLength(1);
  expect((await db.query("select * from telegram_outbox where update_id=103")).rows).toHaveLength(1);
  expect((await finish(104, "guest_booking", payload)).outcome).toBe("stale");
});
it("rolls back booking and session if durable response cannot be saved", async () => {
  await finish(105, "guest_flow", { expected_token: "", flow: { token: "rollback", step: "review", expires: "2099-12-01T00:00:00Z" }, normal: [] });
  const payload = { expected_token: "rollback", guest_booking: { id: "22222222-2222-4222-8222-222222222222", name: "Rollback", phone: "+996700123456", date: "2099-12-02", time: "18:00", guests: 2, table_id: "T3", comment: "" }, normal: [{ method: "unsafe", params: {} }] };
  await expect(finish(106, "guest_booking", payload)).rejects.toThrow();
  expect((await db.query("select * from bookings where name='Rollback'")).rows).toHaveLength(0);
  expect((await db.query("select * from telegram_updates where update_id=106")).rows).toHaveLength(0);
});
