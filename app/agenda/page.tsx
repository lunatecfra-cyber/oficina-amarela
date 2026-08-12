import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { AgendaView } from "@/components/agenda-view";
import { trabalhoDaPauta } from "@/lib/agenda";
import { editoresOnline } from "@/lib/fila-db";
import { pautaReservadaPor } from "@/lib/pautas-db";
import { lerOnboardingEditor } from "@/lib/perfil-db";
import { exigirSessao } from "@/lib/sessao-servidor";

export const metadata: Metadata = { title: "Agenda — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const sessao = await exigirSessao();
  const [perfil, reservada, online] = await Promise.all([
    lerOnboardingEditor(sessao.id),
    pautaReservadaPor(sessao.id),
    editoresOnline(),
  ]);
  const doBanco = perfil?.disponibilidade?.length ? perfil.disponibilidade : null;

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <AgendaView
          doBanco={doBanco}
          naMesa={trabalhoDaPauta(reservada)}
          editoresOnline={online}
        />
      </main>
    </>
  );
}
