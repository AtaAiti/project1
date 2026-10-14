import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, expect, it } from "vitest";
let db: PGlite;
const id = "d4e00000-0000-4000-8000-000000000001";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/20261013000100_0001_baseline.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20261014000100_0003_event_rsvp.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(sql);
  await db.exec(sql);
  await db.exec(
    `insert into events(id,date,time,title_ru,title_en,status,capacity) values('${id}',current_date+30,'19:00','Test','Test','published',3)`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("inserts only through the RPC and returns remaining seats", async () => {
  await db.exec("set role service_role");
  const result = await db.query<{ seats_left: number }>(
    "select * from create_event_rsvp($1,'Reader','+996700000001',2)",
    [id],
  );
  expect(result.rows[0].seats_left).toBe(1);
  await expect(
    db.exec(
      `insert into event_rsvps(event_id,name,phone) values('${id}','Bypass','+996700000099')`,
    ),
  ).rejects.toThrow();
  await db.exec("reset role");
});
it("rejects duplicate, excess guests and edits breaking existing commitments", async () => {
  await expect(
    db.query("select * from create_event_rsvp($1,'Reader','+996700000001',1)", [
      id,
    ]),
  ).rejects.toThrow("duplicate");
  await expect(
    db.query("select * from create_event_rsvp($1,'Reader','+996700000002',2)", [
      id,
    ]),
  ).rejects.toThrow("not_enough_seats");
  await expect(
    db.exec(`update events set capacity=1 where id='${id}'`),
  ).rejects.toThrow("capacity_below_taken");
  await expect(
    db.exec(`update events set time='20:00' where id='${id}'`),
  ).rejects.toThrow("event_schedule_locked");
});
it("competing calls for the last seat produce exactly one insert", async () => {
  // PGlite queues SQL on one connection; live multi-session verification is separate.
  const outcomes = await Promise.allSettled(
    [3, 4].map((n) =>
      db.query("select * from create_event_rsvp($1,'Reader',$2,1)", [
        id,
        `+99670000000${n}`,
      ]),
    ),
  );
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(
    (
      await db.query<{ taken: number }>(
        "select sum(guests)::int taken from event_rsvps where event_id=$1",
        [id],
      )
    ).rows[0].taken,
  ).toBe(3);
});
it("public roles cannot read personal data or execute the writer", async () => {
  for (const role of ["anon", "authenticated"]) {
    expect(
      (
        await db.query<{ ok: boolean }>(
          `select has_function_privilege('${role}','public.create_event_rsvp(uuid,text,text,integer)','execute') ok`,
        )
      ).rows[0].ok,
    ).toBe(false);
    await db.exec(`set role ${role}`);
    await expect(db.exec("select * from event_rsvps")).rejects.toThrow();
    expect(
      (await db.query<{ seats_taken: number }>("select * from event_seats"))
        .rows[0].seats_taken,
    ).toBe(3);
    await db.exec("reset role");
  }
});
it("handles unlimited capacity, past and unpublished events", async () => {
  await db.exec(`update events set capacity=null where id='${id}'`);
  expect(
    (
      await db.query<{ seats_left: null }>(
        "select * from create_event_rsvp($1,'Reader','+996700000005',6)",
        [id],
      )
    ).rows[0].seats_left,
  ).toBeNull();
  await db.exec(`update events set status='draft' where id='${id}'`);
  await expect(
    db.query("select * from create_event_rsvp($1,'Reader','+996700000006',1)", [
      id,
    ]),
  ).rejects.toThrow("event_not_found");
  await db.exec(
    `insert into events(date,time,title_ru,title_en,status) values(current_date-1,'19:00','Past','Past','published')`,
  );
  const past = (
    await db.query<{ id: string }>(
      "select id from events where title_ru='Past'",
    )
  ).rows[0].id;
  await expect(
    db.query("select * from create_event_rsvp($1,'Reader','+996700000006',1)", [
      past,
    ]),
  ).rejects.toThrow("event_past");
});
