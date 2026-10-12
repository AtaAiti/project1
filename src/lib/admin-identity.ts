type AdminUser = {
  id: string;
  email?: string | null;
};

export function hasAdminIdentityConfig() {
  return Boolean(process.env.ADMIN_USER_ID?.trim() || process.env.ADMIN_EMAIL?.trim());
}

export function isAdminUser(user: AdminUser | null | undefined) {
  const adminUserId = process.env.ADMIN_USER_ID?.trim();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLocaleLowerCase();

  if (!adminUserId && !adminEmail) {
    console.error("[admin] Access denied: neither ADMIN_USER_ID nor ADMIN_EMAIL is configured.");
    return false;
  }

  if (!user) return false;
  if (adminUserId) return user.id === adminUserId;

  return Boolean(user.email && user.email.toLocaleLowerCase() === adminEmail);
}
