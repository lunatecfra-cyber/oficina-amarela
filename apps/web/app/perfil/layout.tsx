import { roleHome } from "@oficina/domain/roles";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/server-session";
export default async function RoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.role !== "editor" && session.role !== "admin") redirect(roleHome(session.role));
  return children;
}
