import { redirect } from "next/navigation";
import { AppHeaderInspector } from "@/components/app-header-inspector";
import { requireSession } from "@/lib/server-session";

export default async function InspectorLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (session.role !== "admin") {
    redirect("/login");
  }

  return (
    <>
      <AppHeaderInspector />
      <main className="flex-1">{children}</main>
    </>
  );
}
