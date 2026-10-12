import { randomUUID } from "node:crypto";
import { mediaMetadataSchema } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

export async function uploadMedia(client: ReturnType<typeof createAdminClient>, file: File, folder: unknown) {
  const metadata = mediaMetadataSchema.safeParse({ folder, type: file.type, size: file.size });
  if (!metadata.success) return { errorKey: "validation.file" as const };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signatures = {
    "image/jpeg": bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    "image/png": [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value),
    "image/webp": new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP",
  };
  if (!signatures[metadata.data.type]) return { errorKey: "validation.file" as const };
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[metadata.data.type];
  const path = `${metadata.data.folder}/${randomUUID()}.${extension}`;
  const { error } = await client.storage.from("media").upload(path, bytes, { contentType: metadata.data.type, upsert: false });
  if (error) { console.error("[media] Upload failed."); return { errorKey: "error.generic" as const }; }
  return { path, url: client.storage.from("media").getPublicUrl(path).data.publicUrl };
}
