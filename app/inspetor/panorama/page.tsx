import type { Metadata } from "next";
import { PainelPanorama } from "@/components/painel-panorama";
import { filaDeEdicao, missoesEmVoo, resumoDoSistema } from "@/lib/painel-db";

export const metadata: Metadata = { title: "Panorama — Oficina Amarela" };

// é um retrato do agora: cache aqui mostraria uma fila que já mudou
export const dynamic = "force-dynamic";

export default async function PanoramaPage() {
  const [resumo, fila, emVoo] = await Promise.all([
    resumoDoSistema(),
    filaDeEdicao(),
    missoesEmVoo(),
  ]);

  return <PainelPanorama resumo={resumo} fila={fila} emVoo={emVoo} />;
}
