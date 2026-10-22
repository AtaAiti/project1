/** Run only after deploying the webhook: NODE_USE_ENV_PROXY=1 node scripts/setup-telegram-bot.mjs --apply */
import { randomBytes, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
const apply = process.argv.includes("--apply");
const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://literator-xi.vercel.app";
const env = process.env;
for (const key of [
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "ADMIN_USER_ID",
])
  if (!env[key]) throw new Error(`Missing ${key}`);
async function db(path, method = "GET", body) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok) throw new Error(`Database setup HTTP ${r.status}`);
  return r.status === 204 ? null : r.json();
}
async function tg(method, body = {}) {
  const r = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    },
  );
  const json = await r.json();
  if (!r.ok || !json.ok) throw new Error(`Telegram ${method} HTTP ${r.status}`);
  return json.result;
}
async function main() {
  const me = await tg("getMe"),
    chat = await tg("getChat", { chat_id: env.TELEGRAM_CHAT_ID }),
    owner = await db(`auth/v1/admin/users/${env.ADMIN_USER_ID}`);
  if (chat.type !== "private" || chat.id <= 0 || owner.id !== env.ADMIN_USER_ID)
    throw new Error(
      "Owner must be a verified private chat and existing Auth identity",
    );
  const current = (
    await db("rest/v1/telegram_settings?select=*&id=eq.true")
  )[0];
  const old = await tg("getWebhookInfo");
  const url = `${site}/api/telegram/webhook`;
  if (old.url && old.url !== url)
    throw new Error(
      "A different webhook is already registered; inspect it before replacing",
    );
  console.log(
    `Bot @${me.username}; private owner chat verified; migration ready; mode ${apply ? "apply" : "dry run"}`,
  );
  if (!apply) return;
  // Refuse to steal a chat already linked to a different web user.
  const binding = (
    await db(
      `rest/v1/telegram_admins?select=web_user_id&bot_id=eq.${me.id}&telegram_user_id=eq.${chat.id}`,
    )
  )[0];
  if (binding && binding.web_user_id !== owner.id)
    throw new Error("Owner chat is already connected to another web account");
  const secret = randomBytes(32).toString("hex"),
    hash = createHash("sha256").update(secret).digest("hex");
  await db("rest/v1/telegram_settings", "POST", {
    id: true,
    bot_id: me.id,
    username: me.username,
    secret_hash: hash,
    previous_secret_hash: current?.secret_hash ?? null,
    previous_valid_until: current
      ? new Date(Date.now() + 900000).toISOString()
      : null,
    updated_at: new Date().toISOString(),
  });
  await db(
    `rest/v1/telegram_admins?bot_id=eq.${me.id}&web_user_id=eq.${owner.id}`,
    "DELETE",
  );
  await db("rest/v1/telegram_admins", "POST", {
    bot_id: me.id,
    telegram_user_id: chat.id,
    chat_id: chat.id,
    web_user_id: owner.id,
  });
  await tg("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    max_connections: 5,
  });
  const descriptions = {
    ru: {
      start: "Начать",
      help: "Помощь",
      menu: "Меню",
      tables: "Выбор стола",
      book: "Бронирование",
      events: "Афиша и места",
      contacts: "Контакты",
      language: "Язык / Language",
      today: "Брони на сегодня",
      pending: "Ожидающие заявки",
      booking: "Просмотр брони по ID",
      confirm: "Подтвердить бронь по ID",
      decline: "Отклонить бронь по ID",
      admin: "Веб-кабинет",
    },
    en: {
      start: "Start",
      help: "Help",
      menu: "Menu",
      tables: "Choose a table",
      book: "Book a table",
      events: "Events and seats",
      contacts: "Contacts",
      language: "Language / Язык",
      today: "Today’s bookings",
      pending: "Pending bookings",
      booking: "View booking by ID",
      confirm: "Confirm booking by ID",
      decline: "Decline booking by ID",
      admin: "Admin website",
    },
  };
  for (const locale of ["ru", "en"]) {
    const commands = Object.entries(descriptions[locale]).map(
      ([command, description]) => ({ command, description }),
    );
    await tg("setMyCommands", {
      scope: { type: "default" },
      ...(locale === "ru" ? { language_code: "ru" } : {}),
      commands: commands.slice(0, 8),
    });
    await tg("setMyCommands", {
      scope: { type: "chat", chat_id: chat.id },
      ...(locale === "ru" ? { language_code: "ru" } : {}),
      commands,
    });
  }
  const info = await tg("getWebhookInfo");
  if (info.url !== url) throw new Error("Webhook registration mismatch");
  // No real credentials or webhook secret are printed or written to disk.
  const rejected = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  if (rejected.status !== 401)
    throw new Error(`Webhook rejection failed: ${rejected.status}`);
  const id = Date.now();
  const smoke = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": secret,
    },
    body: JSON.stringify({
      update_id: id,
      message: {
        message_id: 1,
        from: { id: chat.id, is_bot: false, language_code: "ru" },
        chat: { id: chat.id, type: "private" },
        text: "/help",
      },
    }),
  });
  if (!smoke.ok) throw new Error(`Webhook smoke HTTP ${smoke.status}`);
  console.log(
    "Webhook registered; unsigned request rejected; signed /help delivered to owner. Pending updates:",
    info.pending_update_count,
  );
  const ru = JSON.parse(
    await readFile(new URL("../dictionaries/ru.json", import.meta.url), "utf8"),
  );
  await tg("sendMessage", {
    chat_id: chat.id,
    text: `Бот «ЛитераторЪ» подключён.\n\n${ru.bot.adminHelp}\n\nЭто проверка подключения; новые брони не создавались.`,
  });
}
main().catch(() => {
  console.error(
    "Telegram setup failed. Check deployment, environment and database availability; credentials are never logged.",
  );
  process.exitCode = 1;
});
