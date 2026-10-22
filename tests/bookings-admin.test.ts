import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/server/admin", () => ({ authorizeAdmin: mocks.auth }));
import { GET, PATCH } from "@/app/api/admin/bookings/route";
const id = "11111111-1111-4111-8111-111111111111",
  actor = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    status: 200,
    user: { id: actor },
    supabase: { rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({
    data: { outcome: "changed", booking: { id, status: "confirmed" } },
    error: null,
  });
});
const patch = (body: unknown) =>
  PATCH(
    new Request("http://localhost/api/admin/bookings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
it("denies another user", async () => {
  mocks.auth.mockResolvedValue({ status: 403 });
  expect((await GET()).status).toBe(403);
  expect((await patch({ id, status: "confirmed" })).status).toBe(403);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects invalid status and unknown fields", async () => {
  for (const body of [
    { id, status: "new" },
    { id, status: "confirmed", phone: "malicious" },
  ])
    expect((await patch(body)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("uses an atomic expected-status transition and records the web actor", async () => {
  expect(
    (await patch({ id, status: "confirmed", expected_status: "declined" }))
      .status,
  ).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith("transition_booking_status", {
    p_id: id,
    p_status: "confirmed",
    p_expected: "declined",
    p_actor: actor,
    p_source: "web",
  });
});
it.each([
  ["conflict", 409, "error.bookingConflict"],
  ["past", 409, "error.bookingPast"],
  ["not_found", 404, "error.notFound"],
])("maps %s clearly", async (outcome, status, key) => {
  mocks.rpc.mockResolvedValue({ data: { outcome }, error: null });
  const r = await patch({ id, status: "confirmed" });
  expect(r.status).toBe(status);
  expect((await r.json()).errorKey).toBe(key);
});
it("returns unavailable when the transaction fails", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "private" } });
  expect((await patch({ id, status: "confirmed" })).status).toBe(503);
});
