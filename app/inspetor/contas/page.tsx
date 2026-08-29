import type { Metadata } from "next";
import { AccountsPanel } from "@/components/accounts-panel";

export const metadata: Metadata = { title: "Gerenciar Pessoas — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default function AccountsPage() {
  return <AccountsPanel />;
}
