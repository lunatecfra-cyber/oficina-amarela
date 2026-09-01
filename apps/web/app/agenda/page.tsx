import { activeWorkFromMission } from "@oficina/domain/schedule";
import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { ScheduleView } from "@/components/schedule-view";
import { getReservedMission } from "@/lib/missions-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Agenda — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await requireSession();
  const reserved = await getReservedMission(session.id);

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <ScheduleView onDesk={activeWorkFromMission(reserved)} />
      </main>
    </>
  );
}
