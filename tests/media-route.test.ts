import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), upload: vi.fn() }));
vi.mock("@/lib/server/admin", () => ({ authorizeAdmin: mocks.authorize }));
vi.mock("@/lib/server/media", () => ({ uploadMedia: mocks.upload }));
import { POST } from "@/app/api/admin/media/route";
beforeEach(() => { vi.resetAllMocks(); mocks.authorize.mockResolvedValue({ status: 200, supabase: {} }); mocks.upload.mockResolvedValue({ path: "menu/test.jpg", url: "https://example.com/menu/test.jpg" }); });
function request(folder = "menu") { const body = new FormData(); body.append("folder", folder); body.append("file", new File(["data"], "dish.jpg", { type: "image/jpeg" })); return new Request("https://example.com/api/admin/media", { method: "POST", body, headers: { "content-length": "1024" } }); }
it.each([401, 403])("blocks unauthorized upload before storage: %s", async status => { mocks.authorize.mockResolvedValue({ status }); expect((await POST(request())).status).toBe(status); expect(mocks.upload).not.toHaveBeenCalled(); });
it("returns the uploaded menu image URL only after successful storage", async () => { const response = await POST(request()); expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ data: { path: "menu/test.jpg", url: "https://example.com/menu/test.jpg" } }); expect(mocks.upload).toHaveBeenCalledWith({}, expect.any(File), "menu"); });
it("rejects large bodies before parsing or upload", async () => { const response = await POST(new Request("https://example.com/api/admin/media", { method: "POST", body: "unused", headers: { "content-length": String(7 * 1024 * 1024) } })); expect(response.status).toBe(413); expect(mocks.upload).not.toHaveBeenCalled(); });
it("does not report successful upload when storage fails", async () => { mocks.upload.mockResolvedValue({ errorKey: "error.generic" }); expect((await POST(request())).status).toBe(503); });
