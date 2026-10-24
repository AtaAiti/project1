import { routeLocale } from "@/lib/site-seo";
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { hasAdminIdentityConfig } from "@/lib/admin-identity";
import { isAllowedAdminUser } from "@/lib/server/admin-access";

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-site-locale",
    routeLocale(
      request.nextUrl.pathname,
      request.nextUrl.searchParams.get("locale"),
    ),
  );
  const next = () =>
    NextResponse.next({ request: { headers: requestHeaders } });
  let response = next();
  if (!request.nextUrl.pathname.startsWith("/admin")) return response;
  if (
    ["/admin/login", "/admin/reset-password"].includes(request.nextUrl.pathname)
  )
    return response;
  if (!hasAdminIdentityConfig()) {
    console.error(
      "[admin] Access denied: no administrator identities are configured.",
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    console.error(
      "[admin] Access denied: Supabase authentication is not configured.",
    );
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          requestHeaders.set("cookie", request.headers.get("cookie") || "");
          response = next();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/admin/login", request.url));
  if (!(await isAllowedAdminUser(user)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return response;
}
export const config = {
  matcher: ["/admin/:path*", "/ru/:path*", "/en/:path*", "/booking"],
};
