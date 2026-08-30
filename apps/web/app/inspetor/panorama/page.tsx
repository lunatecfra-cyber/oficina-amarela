import type { Metadata } from "next";
import { OverviewPanel } from "@/components/overview-panel";
import { editingQueue, missionsInFlight, systemSummary } from "@/lib/overview-db";

export const metadata: Metadata = { title: "Panorama — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [summary, queue, inFlight] = await Promise.all([
    systemSummary(),
    editingQueue(),
    missionsInFlight(),
  ]);

  return <OverviewPanel summary={summary} queue={queue} inFlight={inFlight} />;
}
