import { redirect } from "next/navigation";
import { authorizeAdmin } from "@/lib/server/admin";
import { isOwnerUser } from "@/lib/server/admin-access";
import { TeamEditor } from "@/components/admin/team-editor";
export default async function Page() {
  const auth = await authorizeAdmin();
  if (auth.status !== 200 || !isOwnerUser(auth.user)) redirect("/admin");
  return <TeamEditor />;
}
