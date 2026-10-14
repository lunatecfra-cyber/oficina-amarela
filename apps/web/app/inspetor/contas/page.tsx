import type { Metadata } from "next";
import { AccountsPanel } from "@/components/accounts-panel";
import { requireCapability } from "@/lib/server-session";

export const metadata: Metadata = { title: "Gerenciar Pessoas — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  await requireCapability("users.manage");
  return <AccountsPanel />;
}
