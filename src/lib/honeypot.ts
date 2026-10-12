/** false means a bot: respond with fake success without persistence or notification. */
export function verifyHoneypot(body: unknown): boolean {
  if (!body || typeof body !== "object") return true;
  const website = (body as Record<string, unknown>).website;
  return website === undefined || website === null || (typeof website === "string" && website.trim() === "");
}
