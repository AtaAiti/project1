import { redirect } from "next/navigation";
import { authorizeAdmin } from "@/lib/server/admin";
import AdminShell from "./admin-shell";
import { isOwnerUser } from "@/lib/server/admin-access";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await authorizeAdmin();
  // Proxy returns 403 for other users. Recheck here so bypassing Proxy never renders content.
  if (auth.status !== 200) redirect("/admin/login");
  return (
    <AdminShell canManageTeam={isOwnerUser(auth.user)}>{children}</AdminShell>
  );
}
