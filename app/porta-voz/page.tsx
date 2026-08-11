import type { Metadata } from "next";
import Link from "next/link";
import {
  PAUTAS,
  ROTULO_FORMATO,
  mensagemStatusPortaVoz,
  type Pauta,
} from "@/lib/pautas";
import { pautasDisponiveis, pautasDoPortaVoz } from "@/lib/pautas-db";
import { lerSessao } from "@/lib/sessao-servidor";

// esta tela precisa refletir a pauta que acabou de ser criada, então não pode
// servir versão em cache
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Minhas Missões — Oficina Amarela" };

// só missão real (id "db-N") tem tela de detalhe; as de demonstração são
// cards estáticos e não existem no banco
const ehReal = (id: string) => id.startsWith("db-");

/**
 * A casca do card. Existe porque as duas listas (na fila / em andamento)
 * precisavam do mesmo `<li>` e do mesmo "vira link se for real" — antes esse
 * bloco estava escrito duas vezes dentro do mesmo `map`.
 *
 * Importante: TODA missão real é clicável, inclusive as já entregues. É por
 * aqui que o porta-voz chega no vídeo pronto e nos botões de aceitar/ajustar.
 */
function CardMissao({
  pauta,
  children,
}: {
  pauta: Pauta;
  children: React.ReactNode;
}) {
  const real = ehReal(pauta.id);
  return (
    <li
      className={`rounded-xl border border-line bg-surface/60 p-4 lg:p-5 ${
        real ? "transition-colors hover:border-gold/40 hover:bg-surface-2" : ""
      }`}
    >
      {real ? (
        <Link href={`/porta-voz/missao/${pauta.id}`} className="group block">
          {children}
        </Link>
      ) : (
        children
      )}
    </li>
  );
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
                  // findIndex devolve -1 quando a missão não está na fila
                  // global; sem essa guarda saía "Posição 0 de N"
                  const idx = filaGeral.findIndex((f) => f.id === p.id);
                  const posicao = idx >= 0 ? idx + 1 : 0;
                  const total = filaGeral.length;
                  return (
                    <CardMissao key={p.id} pauta={p}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text transition-colors group-hover:text-gold-hi">
                          {p.titulo}
                        </h3>
                        <span className="text-xs text-muted">
                          {ROTULO_FORMATO[p.formato]}
                        </span>
                      </div>
                      {posicao > 0 && (
                        <p className="mt-1 text-xs text-muted-2">
                          Posição <b className="text-text">{posicao}</b> de {total} na fila dos editores
                        </p>
                      )}
                    </CardMissao>
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
                  const msg = mensagemStatusPortaVoz(p.status);
                  return (
                    <CardMissao key={p.id} pauta={p}>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold text-text transition-colors group-hover:text-gold-hi">
                            {p.titulo}
                          </h3>
                          <p className="mt-0.5 text-xs text-muted">
                            {ROTULO_FORMATO[p.formato]}
                            {p.reservadaPor && <> · editor: {p.reservadaPor}</>}
                          </p>
                          {p.status === "reedicao" && p.notasInspetor && (
                            <p className="mt-1 text-xs text-muted-2">
                              &ldquo;{p.notasInspetor}&rdquo;
                            </p>
                          )}
                        </div>
                        {msg.texto && (
                          <span className={`text-sm font-medium ${msg.cor}`}>{msg.texto}</span>
                        )}
                      </div>
                    </CardMissao>
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
