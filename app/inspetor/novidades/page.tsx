import type { Metadata } from "next";
import { PainelNovidades } from "@/components/painel-novidades";
import { todasNovidades } from "@/lib/novidades-db";

export const metadata: Metadata = { title: "Novidades — Oficina Amarela" };

// escreveu, tem que aparecer na hora — nada de servir versão em cache
export const dynamic = "force-dynamic";

export default async function NovidadesPage() {
  const lista = await todasNovidades();
  return <PainelNovidades iniciais={lista} />;
}
