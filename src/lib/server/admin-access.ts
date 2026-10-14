import { hasAdminIdentityConfig, isAdminUser } from "@/lib/admin-identity";
import { createAdminClient } from "@/lib/supabase/admin";
type User = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
};
export function isOwnerUser(user: User | null | undefined) {
  if (!user) return false;
  const id = process.env.ADMIN_USER_ID?.trim();
  if (id) return user.id === id;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return Boolean(email && user.email?.trim().toLowerCase() === email);
}
export async function isAllowedAdminUser(user: User | null | undefined) {
  if (!hasAdminIdentityConfig() || !user) return false;
  if (isAdminUser(user)) return true;
  if (!user.email || !user.email_confirmed_at) return false;
  try {
    const { data, error } = await createAdminClient()
      .from("admin_members")
      .select("email")
      .eq("email", user.email.trim().toLowerCase())
      .maybeSingle();
    if (error) {
      console.error("[admin] Team lookup failed; access denied.");
      return false;
    }
    return Boolean(data);
  } catch {
    console.error("[admin] Team lookup failed; access denied.");
    return false;
  }
}
