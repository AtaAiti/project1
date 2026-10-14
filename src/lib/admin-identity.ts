type AdminUser = {
  id: string;
  email?: string | null;
};

export function hasAdminIdentityConfig() {
  return Boolean(
    process.env.ADMIN_USER_ID?.trim() ||
    process.env.ADMIN_EMAIL?.trim() ||
    entries(process.env.ADMIN_USER_IDS).length ||
    entries(process.env.ADMIN_EMAILS).length,
  );
}

function entries(value: string | undefined) {
  return (value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isAdminUser(user: AdminUser | null | undefined) {
  const adminUserId = process.env.ADMIN_USER_ID?.trim();
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLocaleLowerCase();
  const additionalIds = entries(process.env.ADMIN_USER_IDS);
  const additionalEmails = entries(process.env.ADMIN_EMAILS).map((email) =>
    email.toLowerCase(),
  );

  if (!hasAdminIdentityConfig()) {
    console.error(
      "[admin] Access denied: no administrator identities are configured.",
    );
    return false;
  }

  if (!user) return false;
  if (
    additionalIds.includes(user.id) ||
    (user.email && additionalEmails.includes(user.email.trim().toLowerCase()))
  )
    return true;
  if (adminUserId) return user.id === adminUserId;

  return Boolean(user.email && user.email.toLocaleLowerCase() === adminEmail);
}
