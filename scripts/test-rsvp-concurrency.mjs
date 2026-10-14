import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const exec = promisify(execFile);
const container = `literator-rsvp-${randomUUID().slice(0, 8)}`;
const env = { ...process.env };
for (const key of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[key];
const dockerArgs = ["--host=unix:///var/run/docker.sock"];
const docker = (args) =>
  exec("docker", [...dockerArgs, ...args], { env, maxBuffer: 1024 * 1024 });
function sql(query) {
  return new Promise((resolve) => {
    const child = spawn(
      "docker",
      [
        ...dockerArgs,
        "exec",
        "-i",
        container,
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-At",
      ],
      { env },
    );
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("close", (code) => resolve({ code, output }));
    child.stdin.end(query);
  });
}
async function checked(query) {
  const result = await sql(query);
  assert.equal(result.code, 0, result.output);
  return result.output;
}
try {
  await docker([
    "run",
    "--detach",
    "--rm",
    "--name",
    container,
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3",
  ]);
  let ready = false;
  for (let n = 0; n < 50; n++) {
    try {
      await docker(["exec", container, "pg_isready", "-U", "postgres"]);
      ready = true;
      break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, "Postgres did not start");
  await checked(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await checked(
    await readFile(
      new URL(
        "../supabase/migrations/20261013000100_0001_baseline.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await checked(
    await readFile(
      new URL(
        "../supabase/migrations/20261014000100_0003_event_rsvp.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const id = randomUUID();
  await checked(
    `insert into events(id,date,time,title_ru,title_en,status,capacity) values('${id}',current_date+30,'19:00','Concurrency','Concurrency','published',1);`,
  );
  const first = sql(
    `set application_name='rsvp-first';set role service_role;begin;select seats_left from create_event_rsvp('${id}','A','+996700000001',1);select pg_sleep(2);commit;`,
  );
  let locked = false;
  for (let n = 0; n < 50; n++) {
    const activity = await checked(
      "select count(*) from pg_stat_activity where wait_event='PgSleep' and application_name='rsvp-first';",
    );
    if (Number(activity.trim()) > 0) {
      locked = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 30));
  }
  assert.ok(locked, "First transaction did not hold its event lock");
  const second = sql(
    `set role service_role;select seats_left from create_event_rsvp('${id}','B','+996700000002',1);`,
  );
  const [a, b] = await Promise.all([first, second]);
  assert.equal(a.code, 0, a.output);
  assert.notEqual(b.code, 0);
  assert.match(b.output, /sold_out/);
  const total = await checked(
    `select sum(guests) from event_rsvps where event_id='${id}';`,
  );
  assert.equal(Number(total.trim()), 1);
  console.log(
    "PASS: two independent PostgreSQL connections competed for the last seat; one succeeded and one received sold_out. Total guests: 1.",
  );
} finally {
  await docker(["rm", "--force", container]).catch(() => {});
}
