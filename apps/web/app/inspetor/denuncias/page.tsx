import type { Metadata } from "next";
import { ReportsPanel } from "@/components/reports-panel";
import { reportsForInspector } from "@/lib/reports-db";
import { requireCapability } from "@/lib/server-session";

export const metadata: Metadata = { title: "Denúncias — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  await requireCapability("reports.read");
  const reports = await reportsForInspector();
  return <ReportsPanel reports={reports} />;
}
