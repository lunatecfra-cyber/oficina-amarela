import { AppHeaderInspector } from "@/components/app-header-inspector";
import { requireCapability } from "@/lib/server-session";

export default async function InspectorLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("mission.read");

  return (
    <>
      <AppHeaderInspector />
      <main className="flex-1">{children}</main>
    </>
  );
}
