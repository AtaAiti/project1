import { afterEach, expect, it, vi } from "vitest";
import { initializeConfig } from "lighthouse/core/config/config.js";
import VerifiedProxyRobots, {
  proxyLighthouseConfig,
} from "../scripts/lighthouse-robots-proxy.mjs";
const context = {
  baseArtifacts: {
    URL: { finalDisplayedUrl: "https://literator-xi.vercel.app/en/menu" },
  },
};
afterEach(() => vi.unstubAllGlobals());
it("fetches the real robots text at the origin without changing rules", async () => {
  const body = "User-Agent: *\nDisallow: /admin\nUnsupported malformed line";
  const mock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }));
  vi.stubGlobal("fetch", mock);
  expect(await new VerifiedProxyRobots().getArtifact(context)).toEqual({
    status: 200,
    content: body,
  });
  expect(mock.mock.calls[0][0].href).toBe(
    "https://literator-xi.vercel.app/robots.txt",
  );
  expect(mock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it("does not turn an HTTP failure into a successful audit artifact", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })),
  );
  expect(await new VerifiedProxyRobots().getArtifact(context)).toEqual({
    status: 503,
    content: "Unavailable",
  });
});
it("reports transport failure rather than inventing valid robots rules", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  expect(await new VerifiedProxyRobots().getArtifact(context)).toMatchObject({
    status: null,
    content: null,
    errorMessage: expect.any(String),
  });
});

it("initializes the stock Lighthouse config with only the verified robots transport replaced", async () => {
  const flags = { onlyCategories: ["seo"] };
  const original = (await initializeConfig("navigation", undefined, flags))
    .resolvedConfig;
  const custom = (
    await initializeConfig("navigation", proxyLighthouseConfig(), flags)
  ).resolvedConfig;
  expect(custom.categories).toEqual(original.categories);
  expect(custom.settings).toEqual(original.settings);
  const artifact = custom.artifacts.find((a) => a.id === "RobotsTxt");
  expect(artifact.gatherer.path).toBe(
    proxyLighthouseConfig().artifacts[0].gatherer,
  );
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("User-Agent: *\nDisallow: /admin", { status: 200 }),
      ),
  );
  expect(await artifact.gatherer.instance.getArtifact(context)).toEqual({
    status: 200,
    content: "User-Agent: *\nDisallow: /admin",
  });
});
