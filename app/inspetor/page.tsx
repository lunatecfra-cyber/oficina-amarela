import type { Metadata } from "next";
import { FilaInspetor } from "@/components/fila-inspetor";
import { pautasEmRevisao } from "@/lib/pautas-db";
import { lerCandidatosPorApelidos } from "@/lib/candidato-db";
import { mensagensDePautas } from "@/lib/chat-db";

export const metadata: Metadata = { title: "Controle de Qualidade — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function InspetorPage() {
  const pautasReais = await pautasEmRevisao();
  const apelidos = pautasReais.filter((p) => p.portaVozApelido).map((p) => p.portaVozApelido!);
  // conversa de cada missão em revisão — em lote, uma query só
  const ids = pautasReais.map((p) => Number(p.id.replace(/^db-/, "")));
  const [candidatosMapa, mensagensMapa] = await Promise.all([
    lerCandidatosPorApelidos([...new Set(apelidos)]),
    mensagensDePautas(ids),
  ]);
  const candidatosPorApelido = Object.fromEntries(candidatosMapa);
  const mensagensPorPauta = Object.fromEntries(mensagensMapa);
  return (
    <FilaInspetor
      pautasReais={pautasReais}
      candidatosPorApelido={candidatosPorApelido}
      mensagensPorPauta={mensagensPorPauta}
    />
  );
}
