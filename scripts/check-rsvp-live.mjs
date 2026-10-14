import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile),
  base = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  pub = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!base || !key || !pub)
  throw new Error("Supabase environment configuration required");
async function api(path, method = "GET", body, publicCall = false) {
  const token = publicCall ? pub : key;
  const args = [
    "--globoff",
    "--max-time",
    "30",
    "-sS",
    "-w",
    "\n%{http_code}",
    "-X",
    method,
    "-H",
    `apikey: ${token}`,
    "-H",
    "Content-Type: application/json",
  ];
  if (!publicCall) args.push("-H", `Authorization: Bearer ${token}`);
  if (body) args.push("--data", JSON.stringify(body));
  if (method === "POST" && path.startsWith("/rest/v1/events"))
    args.push("-H", "Prefer: return=representation");
  args.push(base + path);
  const { stdout } = await exec("curl", args);
  const at = stdout.lastIndexOf("\n");
  return {
    status: Number(stdout.slice(at + 1)),
    data: stdout.slice(0, at) ? JSON.parse(stdout.slice(0, at)) : null,
  };
}
const ids = [];
async function event(capacity, date = "2099-01-01", status = "published") {
  const id = randomUUID();
  const result = await api("/rest/v1/events", "POST", {
    id,
    date,
    time: "19:00",
    title_ru: "Временная проверка RSVP",
    title_en: "Temporary RSVP check",
    status,
    capacity,
  });
  assert.equal(
    result.status,
    201,
    "Cannot create test event; apply migration first",
  );
  ids.push(id);
  return id;
}
const rpc = (id, phone, guests = 1) =>
  api("/rest/v1/rpc/create_event_rsvp", "POST", {
    p_event_id: id,
    p_name: "Temporary test",
    p_phone: phone,
    p_guests: guests,
  });
try {
  const id = await event(3);
  const first = await rpc(id, "+996700000001", 2);
  assert.equal(first.status, 200);
  assert.equal(first.data[0].seats_left, 1);
  assert.match((await rpc(id, "+996700000001")).data.message, /duplicate/);
  assert.match(
    (await rpc(id, "+996700000002", 2)).data.message,
    /not_enough_seats/,
  );
  const race = await Promise.all([
    rpc(id, "+996700000002"),
    rpc(id, "+996700000003"),
  ]);
  assert.equal(race.filter((r) => r.status === 200).length, 1);
  assert.equal(race.filter((r) => r.data?.message === "sold_out").length, 1);
  const aggregate = await api(
    `/rest/v1/event_seats?event_id=eq.${id}`,
    "GET",
    undefined,
    true,
  );
  assert.equal(Number(aggregate.data[0].seats_taken), 3);
  assert.deepEqual(Object.keys(aggregate.data[0]).sort(), [
    "event_id",
    "seats_taken",
  ]);
  assert.match(
    (await api(`/rest/v1/events?id=eq.${id}`, "PATCH", { capacity: 2 })).data
      .message,
    /capacity_below_taken/,
  );
  assert.match(
    (await api(`/rest/v1/events?id=eq.${id}`, "PATCH", { time: "20:00" })).data
      .message,
    /event_schedule_locked/,
  );
  const unlimited = await event(null);
  assert.equal(
    (await rpc(unlimited, "+996700000004", 6)).data[0].seats_left,
    null,
  );
  const past = await event(10, "2020-01-01");
  assert.match((await rpc(past, "+996700000005")).data.message, /event_past/);
  const draft = await event(10, "2099-01-01", "draft");
  assert.match(
    (await rpc(draft, "+996700000006")).data.message,
    /event_not_found/,
  );
  const direct = await api("/rest/v1/event_rsvps", "POST", {
    event_id: unlimited,
    name: "Bypass",
    phone: "+996700000009",
    guests: 1,
  });
  assert.ok(
    [401, 403].includes(direct.status),
    "Direct insert must be denied even to service_role",
  );
  const deniedRead = await api("/rest/v1/event_rsvps", "GET", undefined, true);
  assert.ok([401, 403].includes(deniedRead.status));
  const deniedRpc = await api(
    "/rest/v1/rpc/create_event_rsvp",
    "POST",
    { p_event_id: id, p_name: "Bypass", p_phone: "+996700000009", p_guests: 1 },
    true,
  );
  assert.ok([401, 403].includes(deniedRpc.status));
  const savedId = first.data[0].id;
  assert.equal(
    (await api(`/rest/v1/event_rsvps?id=eq.${savedId}`, "DELETE")).status,
    204,
  );
  assert.equal((await rpc(id, "+996700000007", 2)).status, 200);
  console.log(
    "PASS: live Supabase last-seat race, duplicate/group/past/draft/unlimited cases, privacy, RPC-only writes, edit guards and released seats.",
  );
} finally {
  for (const id of ids) await api(`/rest/v1/events?id=eq.${id}`, "DELETE");
  console.log(`Temporary events cleaned: ${ids.length}`);
}
