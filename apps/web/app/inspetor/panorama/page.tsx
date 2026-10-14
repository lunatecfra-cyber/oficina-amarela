import type { Metadata } from "next";
import { OverviewPanel } from "@/components/overview-panel";
import { getEditingQueue, getMissionsInFlight, getSystemOverview } from "@/lib/overview-db";
import { requireCapability } from "@/lib/server-session";

export const metadata: Metadata = { title: "Panorama — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  await requireCapability("security.read");
  const [summary, queue, inFlight] = await Promise.all([
    getSystemOverview(),
    getEditingQueue(),
    getMissionsInFlight(),
  ]);

  return <OverviewPanel summary={summary} queue={queue} inFlight={inFlight} />;
}
