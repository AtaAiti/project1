import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/server/admin";
import { apiError } from "@/lib/server/api-error";
import { uploadMedia } from "@/lib/server/media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await authorizeAdmin();
  if (auth.status !== 200) return apiError(auth.status === 401 ? "error.unauthorized" : "error.forbidden", auth.status);
  // Bound uploads before materializing multipart data, including multipart overhead.
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length <= 0 || length > 6 * 1024 * 1024) return apiError("validation.file", 413);
  try {
    const data = await request.formData();
    if ([...data.keys()].some((key) => !["file", "folder"].includes(key)) || data.getAll("file").length !== 1 || data.getAll("folder").length !== 1) return apiError("validation.invalid", 400);
    const file = data.get("file");
    if (!(file instanceof File)) return apiError("validation.file", 400);
    const result = await uploadMedia(auth.supabase, file, data.get("folder"));
    if (result.errorKey) return apiError(result.errorKey, result.errorKey === "validation.file" ? 400 : 503);
    return NextResponse.json({ data: result });
  } catch { return apiError("error.generic", 400); }
}
