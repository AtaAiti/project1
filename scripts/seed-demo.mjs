import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import data from "../src/data/demo-content.json" with { type: "json" };
const {
  menu: demoMenu,
  events: demoEvents,
  gallery: demoGallery,
  reviews: demoReviews,
  stockPhotos,
} = data;
const demoId = (number) =>
  `d3e00000-0000-4000-8000-${String(number).padStart(12, "0")}`;

if (!process.argv.includes("--apply")) {
  console.log(
    "Preview only: 8 menu items, 4 events, 7 gallery photos, 4 fictional reviews and 2 clearly marked demonstration bookings. Pass --apply to insert into the configured Supabase project.",
  );
  process.exit(0);
}
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error("Supabase server configuration is missing.");

function request(path, method, body, extraHeaders = [], binary) {
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
    `apikey: ${key}`,
    "-H",
    `Authorization: Bearer ${key}`,
    ...extraHeaders.flatMap((value) => ["-H", value]),
  ];
  if (binary) args.push("--data-binary", "@-");
  else if (body)
    args.push(
      "-H",
      "Content-Type: application/json",
      "--data",
      JSON.stringify(body),
    );
  args.push(base + path);
  const out = execFileSync("curl", args, {
    encoding: "utf8",
    input: binary,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const position = out.lastIndexOf("\n");
  let data;
  try {
    data = JSON.parse(out.slice(0, position));
  } catch {}
  return { status: Number(out.slice(position + 1)), data };
}

const imageUrls = new Map();
for (const photo of stockPhotos) {
  const path = `gallery/stock/${photo.slug}.jpg`;
  const file = fileURLToPath(
    new URL(`../public/images/stock/${photo.slug}.jpg`, import.meta.url),
  );
  const result = request(
    `/storage/v1/object/media/${path}`,
    "POST",
    null,
    ["Content-Type: image/jpeg", "x-upsert: false"],
    readFileSync(file),
  );
  const duplicate =
    result.status === 409 ||
    /already exists|duplicate/i.test(
      String(result.data?.message || result.data?.error || ""),
    );
  if (result.status !== 200 && !duplicate)
    throw new Error(
      `Stock image upload failed (${photo.slug}, HTTP ${result.status}).`,
    );
  imageUrls.set(
    `/images/stock/${photo.slug}.jpg`,
    `${base}/storage/v1/object/public/media/${path}`,
  );
}

function seed(table, rows) {
  const result = request(`/rest/v1/${table}?on_conflict=id`, "POST", rows, [
    "Prefer: resolution=ignore-duplicates,return=minimal",
  ]);
  if (result.status !== 201)
    throw new Error(`Seed ${table} failed (HTTP ${result.status}).`);
  console.log(
    `${table}: ${rows.length} demo records inserted or preserved; existing rows are never overwritten.`,
  );
}

seed("menu_items", demoMenu);
seed(
  "events",
  demoEvents.map((event) => ({
    ...event,
    image_url: imageUrls.get(event.image_url),
  })),
);
seed(
  "gallery_photos",
  demoGallery.map((photo) => ({
    ...photo,
    image_url: imageUrls.get(photo.image_url),
  })),
);
seed("reviews", demoReviews);
seed("bookings", [
  {
    id: demoId(401),
    name: "Демо · Бронь для просмотра",
    phone: "+996700000001",
    date: "2026-11-07",
    time: "18:00",
    guests: 2,
    comment:
      "Демонстрационная запись. Это не настоящая бронь; уведомление Telegram не отправлялось.",
    status: "pending",
  },
  {
    id: demoId(402),
    name: "Демо · Подтверждённая бронь",
    phone: "+996700000002",
    date: "2026-11-14",
    time: "19:30",
    guests: 3,
    comment: "Демонстрационная запись для просмотра статусов.",
    status: "confirmed",
  },
]);
console.log(
  "Done. No Telegram messages were sent. Keep or edit these examples from the admin panel; rerunning the seed preserves existing edits.",
);
