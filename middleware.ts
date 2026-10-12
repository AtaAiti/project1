import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasAdminIdentityConfig, isAdminUser } from "@/lib/admin-identity";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (["/admin/login", "/admin/reset-password"].includes(request.nextUrl.pathname)) return response;
  if (!hasAdminIdentityConfig()) {
    console.error("[admin] Access denied: neither ADMIN_USER_ID nor ADMIN_EMAIL is configured.");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    console.error("[admin] Access denied: Supabase authentication is not configured.");
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookiesToSet) => { cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));
  if (!isAdminUser(user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return response;
}
export const config = { matcher: ["/admin/:path*"] };
