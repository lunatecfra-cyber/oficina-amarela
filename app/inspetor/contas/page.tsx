import type { Metadata } from "next";
import { PainelContas } from "@/components/painel-contas";

export const metadata: Metadata = { title: "Gerenciar Pessoas — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default function ContasPage() {
  return <PainelContas />;
}
