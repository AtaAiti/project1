import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  update: vi.fn(),
  single: vi.fn(),
}));
vi.mock("@/lib/server/admin", () => ({ authorizeAdmin: mocks.auth }));
import { GET, PATCH } from "@/app/api/admin/bookings/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    status: 200,
    supabase: { from: () => ({ update: mocks.update }) },
  });
  mocks.update.mockReturnValue({
    eq: () => ({ select: () => ({ single: mocks.single }) }),
  });
  mocks.single.mockResolvedValue({
    data: { id: "11111111-1111-4111-8111-111111111111", status: "confirmed" },
    error: null,
  });
});
it("denies booking access to another user", async () => {
  mocks.auth.mockResolvedValue({ status: 403 });
  expect((await GET()).status).toBe(403);
});
it("rejects unknown fields and invalid status", async () => {
  for (const body of [
    { id: "11111111-1111-4111-8111-111111111111", status: "new" },
    {
      id: "11111111-1111-4111-8111-111111111111",
      status: "confirmed",
      phone: "malicious",
    },
  ]) {
    expect(
      (
        await PATCH(
          new Request("http://localhost/api/admin/bookings", {
            method: "PATCH",
            body: JSON.stringify(body),
          }),
        )
      ).status,
    ).toBe(400);
  }
  expect(mocks.update).not.toHaveBeenCalled();
});
it("only updates the allowed status column", async () => {
  const response = await PATCH(
    new Request("http://localhost/api/admin/bookings", {
      method: "PATCH",
      body: JSON.stringify({
        id: "11111111-1111-4111-8111-111111111111",
        status: "confirmed",
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.update).toHaveBeenCalledWith({ status: "confirmed" });
});
