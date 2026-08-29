import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { ScheduleView } from "@/components/schedule-view";
import { taskFromMission } from "@/lib/schedule";
import { missionReservedBy } from "@/lib/missions-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Agenda — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await requireSession();
  const reserved = await missionReservedBy(session.id);

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <ScheduleView onDesk={taskFromMission(reserved)} />
      </main>
    </>
  );
}
