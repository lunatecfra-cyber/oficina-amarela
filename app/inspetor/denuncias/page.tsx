import type { Metadata } from "next";
import { PainelDenuncias } from "@/components/painel-denuncias";
import { denunciasParaInspetor } from "@/lib/denuncias-db";

export const metadata: Metadata = { title: "Denúncias — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function DenunciasPage() {
  const denuncias = await denunciasParaInspetor();
  return <PainelDenuncias denuncias={denuncias} />;
}
