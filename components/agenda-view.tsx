"use client";

import { useEffect, useState } from "react";
import {
  DIAS,
  DISPONIBILIDADE_PADRAO,
  PERIODOS,
  blocoAtual,
  type TrabalhoEmMaos,
} from "@/lib/agenda";
import { MesaAgora } from "@/components/mesa-agora";
import { CelulaDisponibilidade } from "@/components/disponibilidade-cell";

const CHAVE_STORAGE = "confraria:disponibilidade";

export function AgendaView({
  doBanco = null,
  naMesa = [],
  editoresOnline = 0,
}: {
  doBanco?: boolean[][] | null;
  /** missão reservada de verdade (vem do banco, pelo server component) */
  naMesa?: TrabalhoEmMaos[];
  /** quantos editores deram sinal nos últimos minutos */
  editoresOnline?: number;
}) {
  // qual célula é "agora". Só no cliente: o servidor renderiza noutro fuso e
  // a hidratação quebraria
  const [agora, setAgora] = useState<{ periodo: number; dia: number } | null>(null);
  // "salvo" some sozinho — é confirmação, não estado permanente
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    const tick = () => setAgora(blocoAtual());
    const inicial = setTimeout(tick, 0);
    const t = setInterval(tick, 60_000);
    return () => {
      clearTimeout(inicial);
      clearInterval(t);
    };
  }, []);
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
      // grava no banco (fonte da verdade) e no localStorage como reserva.
      // O aviso de "salvo" importa mais agora que a grade decide de verdade
      // quem recebe missão — antes era só decoração.
      fetch("/api/editor/disponibilidade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disponibilidade: novo }),
      })
        .then((r) => {
          if (!r.ok) return;
          setSalvo(true);
          setTimeout(() => setSalvo(false), 1800);
        })
        .catch(() => {
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
      <section className="mt-8" data-guia="mesa-agora">
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
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
                Disponibilidade da semana
              </h2>
              <span className="rounded-full border border-silver-lo/50 bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-silver">
                Beta
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-2">
              Você só recebe oferta de missão nos blocos que estiverem livres.
              Recurso em teste — se sentir que parou de chegar missão sem
              motivo, confira a grade aqui.
            </p>
          </div>
          <span className="flex items-center gap-2 text-xs text-muted">
            {salvo && (
              <span role="status" className="text-ok">
                ✓ salvo
              </span>
            )}
            {livres} {livres === 1 ? "bloco livre" : "blocos livres"}
          </span>
        </div>

        <div
          className="overflow-x-auto rounded-2xl border border-line bg-surface/60 p-4 lg:p-5"
          data-guia="grade-semana"
        >
          <div className="min-w-[420px]">
            <div className="mb-2 grid grid-cols-[64px_repeat(7,1fr)] gap-1.5">
              <span />
              {DIAS.map((d, j) => (
                <span
                  key={d}
                  className={`text-center text-xs font-medium ${
                    agora?.dia === j ? "text-gold-hi" : "text-muted"
                  }`}
                >
                  {d}
                </span>
              ))}
            </div>

            {PERIODOS.map((periodo, p) => (
              <div
                key={periodo}
                className="mb-1.5 grid grid-cols-[64px_repeat(7,1fr)] items-center gap-1.5"
              >
                <span
                  className={`text-xs ${
                    agora?.periodo === p ? "text-gold-hi" : "text-muted-2"
                  }`}
                >
                  {periodo}
                </span>
                {DIAS.map((d, j) => {
                  const livre = disp[p][j];
                  const ehAgora = agora?.periodo === p && agora?.dia === j;
                  return (
                    <CelulaDisponibilidade
                      key={d}
                      livre={livre}
                      onClick={() => toggle(p, j)}
                      // o anel dourado marca o bloco de AGORA: é ele que
                      // decide se uma missão chega neste instante
                      className={
                        ehAgora ? "ring-2 ring-gold ring-offset-2 ring-offset-surface" : ""
                      }
                      label={`${periodo} de ${d}: ${livre ? "livre" : "ocupado"}${
                        ehAgora ? " (agora)" : ""
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-2">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-gradient-to-b from-gold to-gold-lo" />
            livre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-line bg-ink-2" />
            ocupado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm ring-2 ring-gold" />
            agora
          </span>
          <span className="ml-auto">toque pra alternar</span>
        </p>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted">
          <span
            className={`h-2 w-2 rounded-full ${editoresOnline > 0 ? "bg-ok" : "bg-line"}`}
          />
          {editoresOnline === 0
            ? "Nenhum editor online agora."
            : editoresOnline === 1
              ? "1 editor online agora."
              : `${editoresOnline} editores online agora.`}
        </p>
      </section>
    </div>
  );
}
