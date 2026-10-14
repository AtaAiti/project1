import { beforeEach, afterEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  upsert: vi.fn(),
  invite: vi.fn(),
  remove: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/server/admin", () => ({ authorizeAdmin: m.authorize }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: m.rateLimit,
  rateLimitKey: () => "invite:test",
}));
import { POST, DELETE } from "@/app/api/admin/team/route";
const request = (
  email = "member@example.com",
  origin = "https://site.example",
) =>
  new Request("https://site.example/api/admin/team", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify({ email }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("ADMIN_USER_ID", "owner");
  m.authorize.mockResolvedValue({
    status: 200,
    user: { id: "owner", email: "owner@example.com" },
    supabase: {
      from: () => ({ upsert: m.upsert, delete: () => ({ eq: m.remove }) }),
      auth: { admin: { inviteUserByEmail: m.invite } },
    },
  });
  m.upsert.mockResolvedValue({ error: null });
  m.remove.mockResolvedValue({ error: null });
  m.invite.mockResolvedValue({ error: null });
  m.rateLimit.mockResolvedValue({ allowed: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("only the configured owner can grant admin access", async () => {
  m.authorize.mockResolvedValue({
    status: 200,
    user: { id: "staff", email: "staff@example.com" },
  });
  expect((await POST(request())).status).toBe(403);
  expect(m.upsert).not.toHaveBeenCalled();
  expect(m.invite).not.toHaveBeenCalled();
});
it("rejects cross-origin invitations", async () => {
  expect(
    (await POST(request("member@example.com", "https://other.example"))).status,
  ).toBe(403);
  expect(m.upsert).not.toHaveBeenCalled();
});
it("adds a normalized address and sends an invite to the password setup page", async () => {
  const response = await POST(request(" Member@Example.com "));
  expect(response.status).toBe(200);
  expect(m.upsert).toHaveBeenCalledWith(
    { email: "member@example.com" },
    { onConflict: "email" },
  );
  expect(m.invite).toHaveBeenCalledWith("member@example.com", {
    redirectTo: "https://site.example/admin/reset-password",
  });
  expect((await response.json()).invitationSent).toBe(true);
});
it("reports delivery failure without claiming an invitation was sent", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  m.invite.mockResolvedValue({
    error: { code: "email_address_not_authorized" },
  });
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).invitationSent).toBe(false);
});
it("does not replace existing accounts or passwords", async () => {
  m.invite.mockResolvedValue({ error: { code: "email_exists" } });
  expect((await (await POST(request())).json()).existingAccount).toBe(true);
});
it("revokes team access without deleting the Auth account", async () => {
  expect((await DELETE(request())).status).toBe(200);
  expect(m.remove).toHaveBeenCalledWith("email", "member@example.com");
  expect(m.invite).not.toHaveBeenCalled();
});
