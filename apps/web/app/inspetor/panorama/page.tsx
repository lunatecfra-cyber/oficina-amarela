import type { Metadata } from "next";
import { OverviewPanel } from "@/components/overview-panel";
import { getEditingQueue, getMissionsInFlight, getSystemOverview } from "@/lib/overview-db";

export const metadata: Metadata = { title: "Panorama — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const [summary, queue, inFlight] = await Promise.all([
    getSystemOverview(),
    getEditingQueue(),
    getMissionsInFlight(),
  ]);

  return <OverviewPanel summary={summary} queue={queue} inFlight={inFlight} />;
}
