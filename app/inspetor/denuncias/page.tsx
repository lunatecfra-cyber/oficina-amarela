import type { Metadata } from "next";
import { ReportsPanel } from "@/components/reports-panel";
import { reportsForInspector } from "@/lib/reports-db";

export const metadata: Metadata = { title: "Denúncias — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const reports = await reportsForInspector();
  return <ReportsPanel reports={reports} />;
}
