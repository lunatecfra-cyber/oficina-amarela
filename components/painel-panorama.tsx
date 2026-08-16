"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ItemFila, MissaoEmVoo, Resumo } from "@/lib/painel-db";

/** "há 3 dias" contando dias de calendário — mesmo critério das outras telas */
function desdeQuando(iso: string | null) {
  if (!iso) return "—";
  const meiaNoite = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((meiaNoite(new Date()) - meiaNoite(new Date(iso))) / 86_400_000);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses === 1 ? "há 1 mês" : `há ${meses} meses`;
}

/** dias parados — é o número que decide se alguma coisa precisa de empurrão */
function diasParados(iso: string | null) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

const ROTULO_VOO: Record<string, { texto: string; cor: string }> = {
  reservada: { texto: "em edição", cor: "text-gold" },
  em_revisao: { texto: "na conferência", cor: "text-silver-hi" },
  reedicao: { texto: "em reedição", cor: "text-danger" },
};

function Numero({
  valor,
  rotulo,
  destaque,
}: {
  valor: number;
  rotulo: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line-soft bg-surface/40 px-3 py-3">
      <p
        className={`font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums ${
          destaque && valor > 0 ? "text-gold" : "text-text"
        }`}
      >
        {valor}
      </p>
      <p className="mt-0.5 text-[10px] uppercase leading-tight tracking-[0.1em] text-muted-2">
        {rotulo}
      </p>
    </div>
  );
}

export function PainelPanorama({
  resumo,
  fila: filaInicial,
  emVoo,
}: {
  resumo: Resumo;
  fila: ItemFila[];
  emVoo: MissaoEmVoo[];
}) {
  const router = useRouter();
  const [fila, setFila] = useState(filaInicial);
  const [mexendo, setMexendo] = useState<number | null>(null);
  const [apagando, setApagando] = useState<number | null>(null);
  const [confirmaApagar, setConfirmaApagar] = useState<number | null>(null);
  const [notificando, setNotificando] = useState<"editores" | "candidatos" | null>(null);
  const [notificado, setNotificado] = useState<string>("");
  const [aviso, setAviso] = useState("");

  async function mover(id: number, movimento: "subir" | "descer" | "topo") {
    setMexendo(id);
    setAviso("");

    // reordena na tela antes da resposta: a fila é curta e o clique tem que
    // parecer instantâneo. Se o servidor recusar, o router.refresh do fim
    // devolve a ordem de verdade.
    const de = fila.findIndex((f) => f.id === id);
    const para = movimento === "topo" ? 0 : movimento === "subir" ? de - 1 : de + 1;
    if (de >= 0 && para >= 0 && para < fila.length) {
      const nova = [...fila];
      const [item] = nova.splice(de, 1);
      nova.splice(para, 0, item);
      setFila(nova);
    }

    const resp = await fetch("/api/admin/fila", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, movimento }),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => null);
      setAviso(d?.erro ?? "Não deu pra mover.");
    }
    setMexendo(null);
    router.refresh();
  }

  async function apagar(id: number) {
    setApagando(id);
    setAviso("");

    const resp = await fetch(`/api/admin/pautas/${id}`, { method: "DELETE" });
    if (!resp.ok) {
      const d = await resp.json().catch(() => null);
      setAviso(d?.erro ?? "Não deu pra apagar.");
    } else {
      setConfirmaApagar(null);
    }
    setApagando(null);
    router.refresh();
  }

  async function notificar(tipo: "editores" | "candidatos") {
    setNotificando(tipo);
    setAviso("");
    setNotificado("");

    const resp = await fetch("/api/admin/avisar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo }),
    });
    if (!resp.ok) {
      const d = await resp.json().catch(() => null);
      setAviso(d?.erro ?? "Não deu pra enviar.");
    } else {
      const d = await resp.json().catch(() => null);
      const n = d?.enviados ?? "?";
      setNotificado(`${n} e-mail${n !== 1 ? "s" : ""} enviado${n !== 1 ? "s" : ""}.`);
      setTimeout(() => setNotificado(""), 4000);
    }
    setNotificando(null);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
        Panorama
      </h1>
      <p className="mt-1 text-sm text-muted">
        Onde está cada missão e quem está livre pra pegar a próxima.
      </p>

      {/* ── os números ───────────────────────────────────────────── */}
      <section className="mt-6" data-guia="numeros-panorama">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Missões
        </h2>
        <button
          type="button"
          onClick={() => notificar("editores")}
          disabled={notificando !== null || resumo.naFila === 0}
          className="mb-3 text-xs text-muted hover:text-gold disabled:opacity-40"
          title={resumo.naFila === 0 ? "Sem missões na fila" : "Enviar e-mail pra todos os editores"}
        >
          ✉ Avisar editores que há missões na fila
        </button>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <Numero valor={resumo.naFila} rotulo="na fila" destaque />
          <Numero valor={resumo.oferecidas} rotulo="oferecidas" />
          <Numero valor={resumo.emEdicao} rotulo="em edição" />
          <Numero valor={resumo.emConferencia} rotulo="conferindo" destaque />
          <Numero valor={resumo.emReedicao} rotulo="reedição" destaque />
          <Numero valor={resumo.concluidas} rotulo="concluídas" />
        </div>

        <h2 className="mb-3 mt-6 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Gente
        </h2>
        <button
          type="button"
          onClick={() => notificar("candidatos")}
          disabled={notificando !== null || resumo.editoresLivres === 0}
          className="mb-3 text-xs text-muted hover:text-gold disabled:opacity-40"
          title={resumo.editoresLivres === 0 ? "Sem editores livres" : "Enviar e-mail pra todos os candidatos"}
        >
          ✉ Avisar candidatos que há editores livres
        </button>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Numero valor={resumo.candidatos} rotulo="candidatos" />
          <Numero valor={resumo.editores} rotulo="editores" />
          <Numero valor={resumo.editoresLivres} rotulo="editores livres" />
          <Numero valor={resumo.banidos} rotulo="suspensos" />
        </div>
      </section>

      {aviso && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {aviso}
        </p>
      )}
      {notificado && (
        <p className="mt-4 text-sm text-gold-hi">
          {notificado}
        </p>
      )}

      {/* ── a fila ───────────────────────────────────────────────── */}
      <section className="mt-10" data-guia="fila-edicao">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Fila de edição
          </h2>
          <span className="text-xs text-muted-2">
            {fila.length === 1 ? "1 missão" : `${fila.length} missões`}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted">
          Nesta ordem é que o sistema oferece pros editores. Suba o que for
          urgente.
        </p>

        {fila.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Ninguém esperando. Toda missão criada já está com um editor.
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {fila.map((f, i) => {
              const parada = diasParados(f.criadaEm);
              return (
                <li
                  key={f.id}
                  className={`rounded-2xl border bg-surface/60 p-3 lg:p-4 ${
                    parada >= 3 ? "border-gold-lo/50" : "border-line"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line bg-ink-2 font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums text-muted">
                      {i + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-snug text-text">
                        {f.titulo}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-2">
                        {f.candidato} · {f.formato === "short" ? "Short" : "Longo"} ·
                        criada {desdeQuando(f.criadaEm)}
                      </p>
                      {f.status === "oferecida" ? (
                        <p className="mt-1 text-xs text-silver">
                          oferecida a <span className="text-text">@{f.oferecidaPara}</span>{" "}
                          {desdeQuando(f.oferecidaEm)} — esperando resposta
                        </p>
                      ) : (
                        parada >= 3 && (
                          <p className="mt-1 text-xs font-medium text-gold-hi">
                            parada há {parada} dias sem editor
                          </p>
                        )
                      )}
                    </div>
                  </div>

                  {/* Só missão ainda livre se move. A oferecida já está na mão
                      de um editor esperando resposta — mudar o lugar dela na
                      fila não desfaz a oferta, então o botão só enganaria. */}
                  {f.status === "disponivel" && fila.length > 1 && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => mover(f.id, "topo")}
                        disabled={i === 0 || mexendo !== null}
                        className="btn-ghost min-h-11 flex-1 py-2 text-xs disabled:opacity-40"
                      >
                        ↑↑ Topo
                      </button>
                      <button
                        type="button"
                        aria-label={`Subir ${f.titulo}`}
                        onClick={() => mover(f.id, "subir")}
                        disabled={i === 0 || mexendo !== null}
                        className="btn-ghost min-h-11 w-14 py-2 text-xs disabled:opacity-40"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label={`Descer ${f.titulo}`}
                        onClick={() => mover(f.id, "descer")}
                        disabled={i === fila.length - 1 || mexendo !== null}
                        className="btn-ghost min-h-11 w-14 py-2 text-xs disabled:opacity-40"
                      >
                        ↓
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setConfirmaApagar(f.id)}
                    disabled={mexendo !== null}
                    className="btn-ghost mt-2 w-full py-1.5 text-xs text-muted hover:text-danger disabled:opacity-40"
                  >
                    Apagar missão
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ── o que já saiu da fila ────────────────────────────────── */}
      <section className="mt-10" data-guia="em-voo">
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Em andamento
          </h2>
          <span className="text-xs text-muted-2">
            {emVoo.length === 1 ? "1 missão" : `${emVoo.length} missões`}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted">
          Saiu da fila e ainda não fechou. A mais parada aparece primeiro.
        </p>

        {emVoo.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">
            Nada em andamento agora.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {emVoo.map((m) => {
              const r = ROTULO_VOO[m.status] ?? { texto: m.status, cor: "text-muted" };
              const parada = diasParados(m.desde);
              return (
                <li
                  key={m.id}
                  className={`rounded-2xl border bg-surface/60 p-3 lg:p-4 ${
                    parada >= 5 ? "border-danger/40" : "border-line"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold leading-snug text-text">
                      {m.titulo}
                    </h3>
                    <span className={`text-xs font-medium ${r.cor}`}>{r.texto}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-2">
                    {m.candidato} · editor{" "}
                    <span className="text-muted">
                      {m.editor ? `@${m.editor}` : "—"}
                    </span>{" "}
                    · começou {desdeQuando(m.desde)}
                  </p>
                  {parada >= 5 && (
                    <p className="mt-1 text-xs font-medium text-danger">
                      {parada} dias no mesmo lugar
                    </p>
                  )}
                  {m.status === "em_revisao" && m.temEntrega && (
                    <Link
                      href="/inspetor"
                      className="mt-2 inline-block text-xs font-medium text-gold-hi hover:underline"
                    >
                      Conferir agora →
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmaApagar(m.id)}
                    className="mt-2 text-xs text-muted hover:text-danger"
                  >
                    Apagar missão
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── dialog de confirmação de exclusão ──────────────────── */}
      {confirmaApagar !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm"
          onClick={() => setConfirmaApagar(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
              Apagar missão?
            </h3>
            <p className="mt-2 text-sm text-muted">
              A missão e todo o histórico (chat, avaliações) vão sumir pra
              sempre. Essa ação não tem volta.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmaApagar(null)}
                className="btn-ghost min-h-11 flex-1 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => apagar(confirmaApagar)}
                disabled={apagando !== null}
                className="btn-danger min-h-11 flex-1 py-2 text-sm disabled:opacity-50"
              >
                {apagando !== null ? "Apagando…" : "Apagar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
