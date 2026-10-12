import { NextResponse } from "next/server";
import { getDictionary } from "@/lib/dictionaries";

export type ApiErrorKey = keyof ReturnType<typeof getDictionary>["errors"];

/** Keep error for existing admin clients while migrating them to errorKey. */
export function apiError(errorKey: ApiErrorKey, status: number) {
  return NextResponse.json({ errorKey, error: getDictionary("ru").errors[errorKey] }, { status });
}
