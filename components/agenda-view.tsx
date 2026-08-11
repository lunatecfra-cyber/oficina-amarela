"use client";

import { useEffect, useState } from "react";
import { DIAS, DISPONIBILIDADE_PADRAO, PERIODOS, type TrabalhoEmMaos } from "@/lib/agenda";
import { MesaAgora } from "@/components/mesa-agora";
import { CelulaDisponibilidade } from "@/components/disponibilidade-cell";

const CHAVE_STORAGE = "confraria:disponibilidade";

export function AgendaView({
  doBanco = null,
  naMesa = [],
}: {
  doBanco?: boolean[][] | null;
  /** missão reservada de verdade (vem do banco, pelo server component) */
  naMesa?: TrabalhoEmMaos[];
}) {
  // o que veio do onboarding (banco) manda. Sem isso, a agenda mostraria a
  // grade padrão e o editor veria algo diferente do que acabou de preencher.
  const [disp, setDisp] = useState<boolean[][]>(() =>
    doBanco && doBanco.length === DISPONIBILIDADE_PADRAO.length
      ? doBanco.map((linha) => [...linha])
      : DISPONIBILIDADE_PADRAO.map((linha) => [...linha])
  );

  // localStorage só entra se o banco não tiver nada (conta antiga, de antes
  // do onboarding existir)
  useEffect(() => {
    if (doBanco && doBanco.length === DISPONIBILIDADE_PADRAO.length) return;
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE);
      if (salvo) setDisp(JSON.parse(salvo));
    } catch {
      // localStorage indisponivel ou dado corrompido - mantem o padrao
    }
  }, [doBanco]);

  const toggle = (p: number, d: number) =>
    setDisp((atual) => {
      const novo = atual.map((linha, i) =>
        i === p ? linha.map((v, j) => (j === d ? !v : v)) : linha
      );
      // grava no banco (fonte da verdade) e no localStorage como reserva
      fetch("/api/editor/disponibilidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponibilidade: novo }),
      }).catch(() => {
        // sem rede: a mudança ainda vale nesta sessão
      });
      try {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify(novo));
      } catch {
        // sem espaco/permissao no localStorage - a mudanca ainda funciona nesta sessao
      }
      return novo;
    });

  const livres = disp.flat().filter(Boolean).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
          Sua agenda
        </h1>
        <p className="mt-1 text-sm text-muted">
          Marque quando você libera pra pegar missão e acompanhe o que está na sua
          mesa.
        </p>
      </div>

      {/* ---- trabalhos em andamento ---- */}
      <section className="mt-8">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Na sua mesa agora
        </h2>
        {naMesa.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            Nada em andamento. Pegue uma missão na fila.
          </p>
        ) : (
          <MesaAgora trabalhos={naMesa} variant="cards" />
        )}
      </section>

      {/* ---- disponibilidade ---- */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Disponibilidade da semana
          </h2>
          <span className="text-xs text-muted">
            {livres} {livres === 1 ? "bloco livre" : "blocos livres"}
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line bg-surface/60 p-4 lg:p-5">
          <div className="min-w-[420px]">
            <div className="mb-2 grid grid-cols-[64px_repeat(7,1fr)] gap-1.5">
              <span />
              {DIAS.map((d) => (
                <span key={d} className="text-center text-xs font-medium text-muted">
                  {d}
                </span>
              ))}
            </div>

            {PERIODOS.map((periodo, p) => (
              <div
                key={periodo}
                className="mb-1.5 grid grid-cols-[64px_repeat(7,1fr)] items-center gap-1.5"
              >
                <span className="text-xs text-muted-2">{periodo}</span>
                {DIAS.map((d, j) => {
                  const livre = disp[p][j];
                  return (
                    <CelulaDisponibilidade
                      key={d}
                      livre={livre}
                      onClick={() => toggle(p, j)}
                      label={`${periodo} de ${d}: ${livre ? "livre" : "ocupado"}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 flex items-center gap-4 text-xs text-muted-2">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-gradient-to-b from-gold to-gold-lo" />
            livre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-line bg-ink-2" />
            ocupado
          </span>
          <span className="ml-auto">toque pra alternar</span>
        </p>
      </section>
    </div>
  );
}
