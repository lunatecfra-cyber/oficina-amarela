import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { AgendaView } from "@/components/agenda-view";
import { trabalhoDaPauta } from "@/lib/agenda";
import { pautaReservadaPor } from "@/lib/pautas-db";
import { exigirSessao } from "@/lib/sessao-servidor";

export const metadata: Metadata = { title: "Agenda — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const sessao = await exigirSessao();
  const reservada = await pautaReservadaPor(sessao.id);

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <AgendaView naMesa={trabalhoDaPauta(reservada)} />
      </main>
    </>
  );
}
