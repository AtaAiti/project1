import RobotsTxt from "lighthouse/core/gather/gatherers/seo/robots-txt.js";
/**
 * CDP Network.loadNetworkResource bypasses the browser's HTTPS route bridge.
 * Fetch the real public robots.txt through the runtime's verified proxy/CA.
 * The stock Lighthouse robots audit, rules, status and scoring remain unchanged.
 */
export default class VerifiedProxyRobots extends RobotsTxt {
  async getArtifact(context) {
    const url = new URL(
      "/robots.txt",
      context.baseArtifacts.URL.finalDisplayedUrl,
    );
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      return { status: response.status, content: await response.text() };
    } catch {
      return {
        status: null,
        content: null,
        errorMessage: "Verified HTTPS proxy fetch unavailable",
      };
    }
  }
}
