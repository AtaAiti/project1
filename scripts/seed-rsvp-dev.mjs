// Explicit development fixture seed. Never run automatically or against production.
import { execFileSync } from "node:child_process";
const configurations = [
  { label: "normal", capacity: 20, taken: 0 },
  { label: "nearly full", capacity: 3, taken: 2 },
  { label: "sold out", capacity: 2, taken: 2 },
  { label: "unlimited", capacity: null, taken: 0 },
  { label: "past", capacity: 10, taken: 0 },
];
if (!process.argv.includes("--apply")) {
  console.log(
    "Development preview only: normal, nearly full, sold out, unlimited and past events. No writes. Use a development Supabase project and pass --apply --development.",
  );
  process.exit(0);
}
if (
  !process.argv.includes("--development") ||
  process.env.NODE_ENV === "production"
)
  throw new Error(
    "Development-only seed requires --development and cannot run in production mode",
  );
const base = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key)
  throw new Error("Supabase development project configuration required");
function request(path, body) {
  const result = execFileSync(
    "curl",
    [
      "--globoff",
      "--max-time",
      "30",
      "-sS",
      "-w",
      "\n%{http_code}",
      "-X",
      "POST",
      "-H",
      `apikey: ${key}`,
      "-H",
      `Authorization: Bearer ${key}`,
      "-H",
      "Content-Type: application/json",
      "-H",
      "Prefer: resolution=ignore-duplicates,return=representation",
      "--data",
      JSON.stringify(body),
      base + path,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const at = result.lastIndexOf("\n");
  return {
    status: Number(result.slice(at + 1)),
    data: JSON.parse(result.slice(0, at) || "null"),
  };
}
for (const [index, fixture] of configurations.entries()) {
  const id = `d4e00000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
  const event = {
    id,
    date:
      fixture.label === "past"
        ? "2020-01-01"
        : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    time: "19:00",
    title_ru: `DEV RSVP: ${fixture.label}`,
    title_en: `DEV RSVP: ${fixture.label}`,
    description_ru:
      "Демонстрационные данные для разработки RSVP. Не настоящее мероприятие.",
    description_en: "Development RSVP fixture. Not a real event.",
    status: "published",
    capacity: fixture.capacity,
    is_club_meeting: index === 0,
  };
  const created = request("/rest/v1/events?on_conflict=id", event);
  if (created.status !== 201)
    throw new Error(`Event seed failed: HTTP ${created.status}`);
  // Existing rows/registrations may have been edited. Preserve them on repeat runs.
  if (created.data.length && fixture.taken) {
    const rsvp = request("/rest/v1/rpc/create_event_rsvp", {
      p_event_id: id,
      p_name: "DEV RSVP fixture",
      p_phone: `+99670000001${index}`,
      p_guests: fixture.taken,
    });
    if (rsvp.status !== 200)
      throw new Error(`RSVP fixture failed: HTTP ${rsvp.status}`);
  }
}
console.log(
  "Development fixtures created; existing rows preserved. No Telegram messages sent.",
);
