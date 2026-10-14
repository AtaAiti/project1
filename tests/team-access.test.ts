import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: m.lookup }) }) }),
  }),
}));
import { isAllowedAdminUser, isOwnerUser } from "@/lib/server/admin-access";
beforeEach(() => {
  vi.resetAllMocks();
  for (const key of [
    "ADMIN_USER_ID",
    "ADMIN_EMAIL",
    "ADMIN_USER_IDS",
    "ADMIN_EMAILS",
  ])
    vi.stubEnv(key, "");
  vi.stubEnv("ADMIN_USER_ID", "owner");
  m.lookup.mockResolvedValue({ data: null, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("preserves configured owner access without a membership query", async () => {
  expect(await isAllowedAdminUser({ id: "owner" })).toBe(true);
  expect(m.lookup).not.toHaveBeenCalled();
});
it("allows a verified team member, but not owner privileges", async () => {
  m.lookup.mockResolvedValue({
    data: { email: "member@example.com" },
    error: null,
  });
  const user = {
    id: "member",
    email: "Member@Example.com",
    email_confirmed_at: "2026-10-15",
  };
  expect(await isAllowedAdminUser(user)).toBe(true);
  expect(isOwnerUser(user)).toBe(false);
});
it("denies unverified addresses and unrelated accounts", async () => {
  expect(
    await isAllowedAdminUser({ id: "unknown", email: "member@example.com" }),
  ).toBe(false);
  expect(m.lookup).not.toHaveBeenCalled();
  expect(
    await isAllowedAdminUser({
      id: "unknown",
      email: "other@example.com",
      email_confirmed_at: "2026-10-15",
    }),
  ).toBe(false);
});
it("fails closed on lookup failure", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.lookup.mockRejectedValue(new Error("offline"));
  expect(
    await isAllowedAdminUser({
      id: "unknown",
      email: "member@example.com",
      email_confirmed_at: "2026-10-15",
    }),
  ).toBe(false);
});
it("does not use the team table without configured owner/admin identity", async () => {
  vi.stubEnv("ADMIN_USER_ID", "");
  m.lookup.mockResolvedValue({
    data: { email: "member@example.com" },
    error: null,
  });
  expect(
    await isAllowedAdminUser({
      id: "member",
      email: "member@example.com",
      email_confirmed_at: "2026-10-15",
    }),
  ).toBe(false);
  expect(m.lookup).not.toHaveBeenCalled();
});
it("accepts explicit additional env admins while keeping owner privileges separate", async () => {
  vi.stubEnv("ADMIN_EMAILS", "One@Example.com; two@example.com");
  expect(
    await isAllowedAdminUser({ id: "second", email: "TWO@example.com" }),
  ).toBe(true);
  expect(isOwnerUser({ id: "second", email: "TWO@example.com" })).toBe(false);
});
