/** Mobile lab audits against a running local build or production origin. */
import { chromium } from "playwright";
import lighthouse from "lighthouse";
import { mkdir, writeFile } from "node:fs/promises";
const origin = process.argv[2] || "http://127.0.0.1:3095",
  out = process.env.QA_REPORT_DIR || "/tmp/project1-qa/lighthouse";
const paths = (
  process.env.QA_PATHS ||
  "/ru,/ru/about,/ru/menu,/ru/afisha,/ru/contacts,/ru/tables,/booking?locale=ru,/en,/en/menu"
).split(",");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.QA_CHROME_EXECUTABLE || chromium.executablePath(),
  args: ["--remote-debugging-port=9227"],
});
const connection = await chromium.connectOverCDP("http://127.0.0.1:9227"),
  context = connection.contexts()[0];
if (process.env.QA_HTTPS_BRIDGE)
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
const summary = {
  date: new Date().toISOString(),
  origin,
  chrome: browser.version(),
  profile:
    "Lighthouse mobile defaults; simulated throttling; fresh visitor storage",
  httpsBridge: Boolean(process.env.QA_HTTPS_BRIDGE),
  pages: [],
};
try {
  for (const path of paths) {
    const label = path.replace(/[^a-z0-9]/gi, "-"),
      result = await lighthouse(new URL(path, origin).href, {
        port: 9227,
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
        output: ["json", "html"],
        logLevel: "error",
      });
    if (!result || result.lhr.runtimeError)
      throw new Error(`Lighthouse failed on ${path}`);
    await writeFile(`${out}/${label}.json`, result.report[0]);
    await writeFile(`${out}/${label}.html`, result.report[1]);
    const lhr = result.lhr,
      row = {
        path,
        scores: Object.fromEntries(
          Object.entries(lhr.categories).map(([k, v]) => [
            k,
            Math.round(v.score * 100),
          ]),
        ),
        metrics: {
          fcp: lhr.audits["first-contentful-paint"].numericValue,
          lcp: lhr.audits["largest-contentful-paint"].numericValue,
          cls: lhr.audits["cumulative-layout-shift"].numericValue,
          tbt: lhr.audits["total-blocking-time"].numericValue,
        },
        failures: Object.entries(lhr.audits)
          .filter(
            ([, a]) =>
              a.score !== null &&
              a.score < 0.9 &&
              a.scoreDisplayMode !== "informative",
          )
          .map(([id, a]) => ({
            id,
            title: a.title,
            displayValue: a.displayValue,
          })),
      };
    summary.pages.push(row);
    console.log(JSON.stringify({ path, ...row.scores }));
    await writeFile(`${out}/summary.json`, JSON.stringify(summary, null, 2));
  }
} finally {
  await connection.close();
  await browser.close();
}
if (summary.pages.some((row) => row.scores.performance < 85))
  process.exitCode = 1;
