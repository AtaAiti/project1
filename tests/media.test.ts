import { expect, it, vi } from "vitest";
import { uploadMedia } from "@/lib/server/media";
import type { createAdminClient } from "@/lib/supabase/admin";

function storageClient() {
  const upload = vi.fn().mockResolvedValue({ error: null });
  const bucket = { upload, getPublicUrl: (path: string) => ({ data: { publicUrl: "https://example.com/media/" + path } }) };
  const client = { storage: { from: vi.fn().mockReturnValue(bucket) } } as unknown as ReturnType<typeof createAdminClient>;
  return { client, upload };
}

it("rejects invalid metadata and fake image contents without calling storage", async () => {
  const { client, upload } = storageClient();
  expect(await uploadMedia(client, new File(["fake"], "fake.png", { type: "image/png" }), "gallery")).toEqual({ errorKey: "validation.file" });
  expect(await uploadMedia(client, new File(["fake"], "fake.svg", { type: "image/svg+xml" }), "gallery")).toEqual({ errorKey: "validation.file" });
  expect(await uploadMedia(client, new File(["fake"], "fake.png", { type: "image/png" }), "../../private")).toEqual({ errorKey: "validation.file" });
  expect(upload).not.toHaveBeenCalled();
});

it("generates a safe unique path without overwriting existing objects", async () => {
  const { client, upload } = storageClient();
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const result = await uploadMedia(client, new File([bytes], "../../input.png", { type: "image/png" }), "books");
  expect(result.path).toMatch(/^books\/[0-9a-f-]{36}\.png$/);
  expect(upload).toHaveBeenCalledWith(result.path, expect.any(Uint8Array), { contentType: "image/png", upsert: false });
});
