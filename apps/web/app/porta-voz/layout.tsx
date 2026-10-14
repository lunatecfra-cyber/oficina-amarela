import { roleHome } from "@oficina/domain/roles";
import { redirect } from "next/navigation";
import { AppHeaderSpokesperson } from "@/components/app-header-spokesperson";
import { requireSession } from "@/lib/server-session";

export default async function SpokespersonLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  if (session.role !== "spokesperson" && session.role !== "admin") redirect(roleHome(session.role));

  return (
    <>
      <AppHeaderSpokesperson />
      <main className="flex-1">{children}</main>
    </>
  );
}
