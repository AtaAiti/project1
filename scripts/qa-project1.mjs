/** Browser acceptance checks. See docs/project1-final-review.md for setup and limitations. */
import { chromium, firefox, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = new URL(process.argv[2] || "http://127.0.0.1:3094"),
  out = process.env.QA_REPORT_DIR || "/tmp/project1-qa/reports";
const ru = JSON.parse(
    await readFile(new URL("../dictionaries/ru.json", import.meta.url), "utf8"),
  ),
  en = JSON.parse(
    await readFile(new URL("../dictionaries/en.json", import.meta.url), "utf8"),
  );
const report = {
    date: new Date().toISOString(),
    origin: base.origin,
    browsers: [],
    checks: [],
  },
  users = [];
let db, staff, other, staffEmail;
await mkdir(out, { recursive: true });
function pass(name) {
  report.checks.push({ name, status: "passed" });
  console.log("PASS", name);
}
function url(path) {
  return new URL(path, base).href;
}
async function bridge(context) {
  if (!process.env.QA_HTTPS_BRIDGE) return;
  // Use the runtime's verified proxy/CA trust. Never turn off browser TLS verification.
  await context.route("https://**", async (route) => {
    try {
      const req = route.request(),
        body = req.postDataBuffer();
      const r = await fetch(req.url(), {
        method: req.method(),
        headers: await req.allHeaders(),
        ...(body ? { body } : {}),
        redirect: "manual",
      });
      const headers = Object.fromEntries(r.headers);
      for (const key of [
        "content-encoding",
        "content-length",
        "transfer-encoding",
      ])
        delete headers[key];
      await route.fulfill({
        status: r.status,
        headers,
        body: Buffer.from(await r.arrayBuffer()),
      });
    } catch {
      await route.abort("failed");
    }
  });
}
async function prepareAuth() {
  if (!process.argv.includes("--with-auth")) return;
  assert.ok(
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    "Configure Supabase before auth checks",
  );
  db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  async function account() {
    const email = `qa-project1-${randomUUID()}@example.com`,
      password = randomUUID() + randomUUID();
    const r = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.equal(r.error, null, "Temporary Auth account");
    users.push(r.data.user.id);
    return { email, password };
  }
  const a = await account(),
    b = await account();
  staffEmail = a.email;
  assert.equal(
    (await db.from("admin_members").insert({ email: staffEmail })).error,
    null,
  );
  async function cookies(account) {
    let jar = [];
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll: () => jar,
          setAll: (values) => {
            for (const value of values) {
              jar = jar.filter((c) => c.name !== value.name);
              jar.push(value);
            }
          },
        },
      },
    );
    assert.equal((await client.auth.signInWithPassword(account)).error, null);
    return jar.map(({ name, value }) => ({
      name,
      value,
      domain: base.hostname,
      path: "/",
    }));
  }
  staff = await cookies(a);
  other = await cookies(b);
}
const requested = (
  process.env.QA_BROWSERS || "chrome,edge,firefox,webkit"
).split(",");
const configs = {
  chrome: [
    chromium,
    {
      executablePath:
        process.env.QA_CHROME_EXECUTABLE || chromium.executablePath(),
    },
  ],
  edge: [
    chromium,
    process.env.QA_EDGE_EXECUTABLE
      ? { executablePath: process.env.QA_EDGE_EXECUTABLE }
      : { channel: "msedge" },
  ],
  firefox: [firefox, {}],
  webkit: [
    webkit,
    process.env.QA_WEBKIT_EXECUTABLE
      ? { executablePath: process.env.QA_WEBKIT_EXECUTABLE }
      : {},
  ],
};
try {
  await prepareAuth();
  for (const name of requested) {
    let browser;
    const row = { name, status: "running", version: null, axe: [] };
    report.browsers.push(row);
    try {
      const [engine, options] = configs[name];
      browser = await engine.launch({
        headless: true,
        timeout: 30000,
        ...options,
      });
      row.version = browser.version();
      for (const [locale, d] of [
        ["ru", ru],
        ["en", en],
      ]) {
        const c = await browser.newContext({
          viewport: { width: 390, height: 844 },
        });
        await bridge(c);
        const p = await c.newPage();
        await p.goto(url("/" + locale), { waitUntil: "domcontentloaded" });
        const age = p.getByRole("dialog", { name: d.ageGate.title });
        await age.waitFor();
        assert.equal(await p.locator("html").getAttribute("lang"), locale);
        await p.keyboard.press("Escape");
        assert.ok(
          await age.isVisible(),
          "Age confirmation requires an explicit answer",
        );
        for (let i = 0; i < 4; i++) {
          await p.keyboard.press("Tab");
          assert.ok(
            await age.evaluate((el) => el.contains(document.activeElement)),
            "Age dialog traps focus",
          );
        }
        const scan = await new AxeBuilder({ page: p })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          scan.violations.map((v) => v.id),
          [],
          `${name} ${locale} age accessibility`,
        );
        await age
          .getByRole("button", { name: d.ageGate.yes, exact: true })
          .click();
        await age.waitFor({ state: "hidden" });
        assert.equal(
          await p.evaluate(() => localStorage.getItem("age-confirmed")),
          "true",
        );
        await p.reload();
        assert.equal(await age.isVisible(), false);
        await c.close();
      }
      pass(
        name + ": localized age gate, keyboard trap and persisted confirmation",
      );
      const exitContext = await browser.newContext();
      await bridge(exitContext);
      await exitContext.route("https://www.google.com/**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<title>Neutral exit</title>",
        }),
      );
      const exit = await exitContext.newPage();
      await exit.goto(url("/en"));
      await exit
        .getByRole("dialog", { name: en.ageGate.title })
        .getByRole("button", { name: en.ageGate.no, exact: true })
        .click();
      await exit.waitForURL("https://www.google.com/");
      await exitContext.close();
      const blocked = await browser.newContext();
      await bridge(blocked);
      await blocked.addInitScript(() =>
        Object.defineProperty(window, "localStorage", {
          get() {
            throw new DOMException("Blocked", "SecurityError");
          },
        }),
      );
      const privatePage = await blocked.newPage();
      await privatePage.goto(url("/en"));
      const blockedGate = privatePage.getByRole("dialog", {
        name: en.ageGate.title,
      });
      await blockedGate
        .getByRole("button", { name: en.ageGate.yes, exact: true })
        .click();
      await blockedGate.waitFor({ state: "hidden" });
      await blocked.close();
      pass(
        name +
          ": neutral under-18 exit and usable confirmation with blocked storage",
      );

      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
      });
      await bridge(context);
      await context.addInitScript(() => {
        localStorage.setItem("age-confirmed", "true");
        localStorage.setItem(
          "literator-consent-v1",
          JSON.stringify({ version: 1, externalMedia: false }),
        );
      });
      const page = await context.newPage(),
        errors = [];
      page.on("pageerror", (error) => errors.push(error.name));
      const paths = (
        process.env.QA_PATHS ||
        "/ru,/ru/about,/ru/menu,/ru/afisha,/ru/contacts,/ru/tables,/booking?locale=ru,/en,/en/menu"
      ).split(",");
      for (const path of paths) {
        const response = await page.goto(url(path), {
          waitUntil: "networkidle",
        });
        assert.equal(response.status(), 200, path);
        const locale =
          path.startsWith("/en") ||
          new URL(path, base).searchParams.get("locale") === "en"
            ? "en"
            : "ru";
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.ok(
          await page.locator("meta[name=description]").getAttribute("content"),
        );
        assert.equal(
          await page.locator("link[rel=canonical]").getAttribute("href"),
          "https://literator-xi.vercel.app" + path,
        );
        assert.equal(
          await page.locator("link[rel=alternate][hreflang=en]").count(),
          1,
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          path + " mobile overflow",
        );
        const axe = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        row.axe.push({
          path,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => n.target),
          })),
        });
      }
      pass(
        name +
          ": public routes, SSR metadata, canonical/hreflang and mobile layout",
      );
      await page.goto(url("/ru/menu"));
      const open = page.getByRole("button", {
        name: ru.publicUi.openMenu,
        exact: true,
      });
      await open.click();
      const menu = page.getByRole("dialog", {
        name: ru.publicUi.navigation,
        exact: true,
      });
      await menu.waitFor();
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press("Tab");
        assert.ok(
          await menu.evaluate((el) => el.contains(document.activeElement)),
          "Mobile menu traps focus",
        );
      }
      await page.keyboard.press("Escape");
      await menu.waitFor({ state: "hidden" });
      assert.ok(
        await open.evaluate((el) => el === document.activeElement),
        "Escape returns focus",
      );
      await open.click();
      await menu.getByRole("link", { name: "EN", exact: true }).click();
      await page.waitForURL("**/en/menu");
      await page.waitForFunction(() => document.documentElement.lang === "en");
      pass(
        name + ": mobile menu focus/Escape and language switch preserves page",
      );
      await page.goto(url("/ru/about"));
      const photo = page.locator("figure button").first();
      if (await photo.count()) {
        await photo.click();
        const gallery = page.getByRole("dialog", {
          name: ru.publicUi.gallery,
          exact: true,
        });
        await gallery.waitFor();
        const scan = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        assert.deepEqual(
          scan.violations.map((v) => v.id),
          [],
          name + " gallery dialog accessibility",
        );
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("Escape");
        await gallery.waitFor({ state: "hidden" });
        assert.ok(await photo.evaluate((el) => el === document.activeElement));
      }
      await page.goto(url("/booking?locale=en"));
      let submissions = 0;
      page.on("request", (r) => {
        if (
          new URL(r.url()).pathname === "/api/booking" &&
          r.method() === "POST"
        )
          submissions++;
      });
      await page
        .getByRole("button", { name: en.booking.submit, exact: true })
        .click();
      await page.locator("form [role=alert]").waitFor();
      assert.equal(submissions, 0, "Invalid booking must not reach the API");
      await page.goto(url("/ru"));
      await page.locator('a[href="#about-literator"]').click();
      assert.equal(new URL(page.url()).hash, "#about-literator");
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).scrollBehavior,
        ),
        "auto",
      );
      pass(
        name +
          ": gallery keyboard controls, booking validation, hero anchor and reduced motion",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(url("/en/menu"));
      await page
        .locator("header nav")
        .getByRole("link", { name: "RU", exact: true })
        .click();
      await page.waitForURL("**/ru/menu");
      await page.waitForFunction(() => document.documentElement.lang === "ru");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      await page.screenshot({
        path: `${out}/${name}-desktop.png`,
        fullPage: false,
      });
      const anon = await browser.newContext();
      await bridge(anon);
      assert.equal(
        (await anon.request.get(url("/api/admin/menu_items"))).status(),
        401,
      );
      const login = await anon.newPage();
      await login.goto(url("/admin"));
      await login.waitForURL("**/admin/login");
      assert.match(
        await login.locator("meta[name=robots]").getAttribute("content"),
        /noindex/,
      );
      await anon.close();
      if (staff) {
        const c = await browser.newContext();
        await bridge(c);
        await c.addCookies(staff);
        const admin = await c.newPage();
        assert.equal((await admin.goto(url("/admin/menu"))).status(), 200);
        await admin
          .getByRole("heading", { name: ru.admin.menu, exact: true })
          .waitFor();
        assert.equal(await admin.locator("html").getAttribute("lang"), "ru");
        await c.close();
        const denied = await browser.newContext();
        await bridge(denied);
        await denied.addCookies(other);
        const p = await denied.newPage();
        assert.equal((await p.goto(url("/admin"))).status(), 403);
        assert.equal(
          (await denied.request.get(url("/api/admin/menu_items"))).status(),
          403,
        );
        await denied.close();
      }
      pass(name + ": desktop switching, admin noindex and access control");
      assert.deepEqual(errors, [], "No client-side exceptions");
      const violations = row.axe.flatMap((a) => a.violations);
      assert.deepEqual(violations, [], name + " public accessibility");
      row.status = "passed";
    } catch (error) {
      row.status = "failed";
      row.error = error.message.slice(0, 2200);
      console.error("FAIL", name, row.error);
      process.exitCode = 1;
    } finally {
      await browser?.close();
      await writeFile(
        `${out}/browser-report.json`,
        JSON.stringify(report, null, 2),
      );
    }
  }
} finally {
  if (db) {
    if (staffEmail)
      assert.equal(
        (await db.from("admin_members").delete().eq("email", staffEmail)).error,
        null,
      );
    for (const id of users)
      assert.equal((await db.auth.admin.deleteUser(id)).error, null);
    console.log("Temporary QA accounts removed");
  }
  await writeFile(
    `${out}/browser-report.json`,
    JSON.stringify(report, null, 2),
  );
}
