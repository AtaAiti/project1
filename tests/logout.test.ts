import { beforeEach, describe, expect, it, vi } from "vitest";
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ auth: { signOut } })) }));
import { POST } from "@/app/api/auth/logout/route";
describe("logout", () => {
  beforeEach(() => { signOut.mockReset(); });
  it("rejects a request from another origin without changing the session", async () => {
    const response = await POST(new Request("https://site.example/api/auth/logout", { method: "POST", headers: { origin: "https://other.example" } }));
    expect(response.status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
  });
  it("signs out through the server session", async () => {
    signOut.mockResolvedValue({ error: null });
    const response = await POST(new Request("https://site.example/api/auth/logout", { method: "POST", headers: { origin: "https://site.example" } }));
    expect(response.status).toBe(200);
    expect(signOut).toHaveBeenCalledOnce();
  });
  it("reports failure instead of claiming that logout succeeded", async () => {
    signOut.mockResolvedValue({ error: new Error("Auth unavailable") });
    const response = await POST(new Request("https://site.example/api/auth/logout", { method: "POST", headers: { origin: "https://site.example" } }));
    expect(response.status).toBe(503);
    expect((await response.json()).errorKey).toBe("error.generic");
  });
  it("uses the public host behind the Next/Vercel proxy", async () => {
    signOut.mockResolvedValue({ error: null });
    const response = await POST(new Request("http://localhost:3000/api/auth/logout", { method: "POST", headers: { origin: "https://site.example", host: "site.example", "x-forwarded-proto": "https" } }));
    expect(response.status).toBe(200);
    expect(signOut).toHaveBeenCalledOnce();
  });
});
