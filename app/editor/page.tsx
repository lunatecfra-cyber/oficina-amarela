import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { DesafiosDia } from "@/components/desafios-dia";
import { MissaoEmMaos } from "@/components/missao-em-maos";
import { OfertaMissao } from "@/components/oferta-missao";
import { pautaReservadaPor } from "@/lib/pautas-db";
import { exigirSessao } from "@/lib/sessao-servidor";

export const metadata: Metadata = { title: "Fila — Oficina Amarela" };

// o card de oferta depende do que acabou de ser despachado, então não pode
// vir de cache
export const dynamic = "force-dynamic";

// Dispatch puro: o editor não navega por lista nenhuma. Ou ele tem uma
// missão em mãos, ou está esperando a próxima oferta chegar. A lista de
// "missões disponíveis" saiu daqui de propósito — deixar as duas coisas na
// mesma tela fazia a mesma missão aparecer duas vezes (oferta + lista) com
// um "Reservar" que já não funcionava.
export default async function EditorPage() {
  const sessao = await exigirSessao();
  const minhaAtual = await pautaReservadaPor(sessao.id);

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
          <div className="mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
              Fila de missões
            </h1>
            <p className="mt-1 text-sm text-muted">
              {minhaAtual
                ? "Você já tem uma missão em mãos. Entregue pra receber a próxima."
                : "As missões chegam até você, uma por vez. Aceite ou passe — se passar, vai pro próximo editor."}
            </p>
          </div>

          <MissaoEmMaos missao={minhaAtual} />
          {/* com missão em mãos o componente some sozinho — não há o que
              oferecer a quem já está trabalhando */}
          <OfertaMissao temMissaoEmMaos={!!minhaAtual} />

          {/* pausa visual: o que vem abaixo é extra, não faz parte do fluxo
              principal de receber e entregar missão */}
          <div
            aria-hidden="true"
            className="my-10 h-px rounded-full"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(244,206,31,0.35) 30%, rgba(244,206,31,0.5) 50%, rgba(244,206,31,0.35) 70%, transparent 100%)",
            }}
          />

          <DesafiosDia />
        </div>
      </main>
    </>
  );
}
