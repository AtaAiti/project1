import { hasAdminIdentityConfig } from "@/lib/admin-identity";
import { isAllowedAdminUser } from "@/lib/server/admin-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { unstable_rethrow } from "next/navigation";

export async function authorizeAdmin() {
  if (!hasAdminIdentityConfig()) {
    console.error(
      "[admin] Access denied: no administrator identities are configured.",
    );
    return { status: 403 as const };
  }
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error(
      "[admin] Access denied: Supabase credentials are not configured.",
    );
    return { status: 403 as const };
  }
  try {
    const authClient = await createClient();
    const {
      data: { user },
      error,
    } = await authClient.auth.getUser();
    if (error || !user) return { status: 401 as const };
    if (!(await isAllowedAdminUser(user))) return { status: 403 as const };
    return { status: 200 as const, supabase: createAdminClient(), user };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[admin] Authentication failed; access denied.");
    return { status: 403 as const };
  }
}
