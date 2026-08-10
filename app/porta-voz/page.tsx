import type { Metadata } from "next";
import Link from "next/link";
import { PAUTAS, ROTULO_FORMATO, type Pauta } from "@/lib/pautas";
import { pautasDisponiveis, pautasDoPortaVoz } from "@/lib/pautas-db";
import { lerSessao } from "@/lib/sessao-servidor";

// esta tela precisa refletir a pauta que acabou de ser criada, então não pode
// servir versão em cache
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Minhas Missões — Oficina Amarela" };

// mensagem amigável de status, do ponto de vista de quem tá esperando o vídeo
function mensagemStatus(status: Pauta["status"]): { texto: string; cor: string } {
  switch (status) {
    case "reservada":
    case "minha":
    case "em_revisao":
      return { texto: "🎬 Seu vídeo começou a ser feito", cor: "text-gold-hi" };
    case "reedicao":
      return { texto: "💬 O editor tem uma observação", cor: "text-silver-hi" };
    case "aprovada":
      return { texto: "✅ Seu vídeo está pronto!", cor: "text-ok" };
    default:
      return { texto: "", cor: "" };
  }
}

export default async function PortaVozHome() {
  const sessao = await lerSessao();

  // pautas de verdade (banco) + as de demonstração que batem com o nome —
  // as fake existem só pra tela não ficar vazia numa conta nova
  const [reaisMinhas, reaisDisponiveis] = await Promise.all([
    sessao ? pautasDoPortaVoz(sessao.id) : Promise.resolve([]),
    pautasDisponiveis(),
  ]);

  const demoMinhas = PAUTAS.filter((p) => p.portaVoz === sessao?.nome);
  const minhas = [...reaisMinhas, ...demoMinhas];

  // fila compartilhada: todas as pautas disponíveis (de todo mundo), ordenadas por criação
  const filaGeral = [...reaisDisponiveis, ...PAUTAS.filter((p) => p.status === "disponivel")].sort(
    (a, b) => a.criadaEm.localeCompare(b.criadaEm)
  );

  const naFila = minhas.filter((p) => p.status === "disponivel");
  const emAndamento = minhas.filter((p) => p.status !== "disponivel");

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Minhas missões
          </h1>
          <p className="mt-1 text-sm text-muted">
            Acompanhe o status de cada vídeo que você mandou pra guilda.
          </p>
        </div>
        <Link href="/porta-voz/nova-pauta" className="btn-gold w-auto px-6">
          + Nova missão
        </Link>
      </div>

      {minhas.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-muted">Você ainda não criou nenhuma missão.</p>
          <Link
            href="/porta-voz/nova-pauta"
            className="mt-4 inline-block font-medium text-gold-hi hover:underline"
          >
            Criar a primeira
          </Link>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {naFila.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
                Na fila
              </h2>
              <ul className="flex flex-col gap-3">
                {naFila.map((p) => {
                  const posicao = filaGeral.findIndex((f) => f.id === p.id) + 1;
                  const total = filaGeral.length;
                  const pct = total > 1 ? Math.round(((total - posicao) / (total - 1)) * 100) : 100;
                  // só pautas reais (id "db-...") têm tela de detalhe; demos
                  // continuam como card estático
                  const real = p.id.startsWith("db-");
                  return (
                    <li
                      key={p.id}
                      className={`rounded-xl border border-line bg-surface/60 p-4 lg:p-5 ${
                        real ? "transition-colors hover:border-gold/40 hover:bg-surface-2" : ""
                      }`}
                    >
                      {real ? (
                        <Link href={`/porta-voz/missao/${p.id}`} className="block">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text group-hover:text-gold-hi">
                              {p.titulo}
                            </h3>
                            <span className="text-xs text-muted">
                              {ROTULO_FORMATO[p.formato]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-2">
                            Posição <b className="text-text">{posicao}</b> de {total} na fila dos editores
                          </p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </Link>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
                              {p.titulo}
                            </h3>
                            <span className="text-xs text-muted">
                              {ROTULO_FORMATO[p.formato]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-2">
                            Posição <b className="text-text">{posicao}</b> de {total} na fila dos editores
                          </p>
                          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {emAndamento.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-gold">
                Em andamento e concluídas
              </h2>
              <ul className="flex flex-col gap-3">
                {emAndamento.map((p) => {
                  const msg = mensagemStatus(p.status);
                  return (
                    <li
                      key={p.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface/60 p-4 lg:p-5"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text">
                          {p.titulo}
                        </h3>
                        <p className="mt-0.5 text-xs text-muted">
                          {ROTULO_FORMATO[p.formato]}
                          {p.reservadaPor && <> · editor: {p.reservadaPor}</>}
                        </p>
                        {p.status === "reedicao" && p.notasInspetor && (
                          <p className="mt-1 text-xs text-muted-2">"{p.notasInspetor}"</p>
                        )}
                      </div>
                      {msg.texto && (
                        <span className={`text-sm font-medium ${msg.cor}`}>{msg.texto}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
