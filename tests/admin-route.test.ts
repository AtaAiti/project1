import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/server/admin", () => ({ authorizeAdmin: mocks.authorize }));
import { GET, POST, PATCH, DELETE } from "@/app/api/admin/[resource]/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.authorize.mockResolvedValue({ status: 200, supabase: { from: mocks.from } });
});
const id = "11111111-1111-4111-8111-111111111111";
const ctx = (resource: string) => ({ params: Promise.resolve({ resource }) });
const req = (method: string, body?: unknown) => new Request("http://localhost/api/admin/events", { method, ...(body ? { body: JSON.stringify(body) } : {}) });

describe("admin API hardening", () => {
  it.each([["GET", GET], ["POST", POST], ["PATCH", PATCH], ["DELETE", DELETE]] as const)("rejects unknown resource for %s", async (method, handler) => {
    const response = await handler(req(method), ctx("bookings"));
    expect(response.status).toBe(404);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([["POST", POST], ["PATCH", PATCH], ["DELETE", DELETE]] as const)("rejects unknown body fields for %s", async (method, handler) => {
    const response = await handler(req(method, { id, malicious: true }), ctx("events"));
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it.each([["GET", GET], ["POST", POST], ["PATCH", PATCH], ["DELETE", DELETE]] as const)("denies the wrong user for %s", async (method, handler) => {
    mocks.authorize.mockResolvedValue({ status: 403 });
    expect((await handler(req(method), ctx("events"))).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON instead of crashing", async () => {
    const request = new Request("http://localhost/api/admin/events", { method: "POST", body: "{" });
    expect((await POST(request, ctx("events"))).status).toBe(400);
  });
  it.each([["POST", POST], ["PATCH", PATCH]] as const)("forbids generic RSVP writes for %s", async (method, handler) => {
    expect((await handler(req(method), ctx("event_rsvps"))).status).toBe(405);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
