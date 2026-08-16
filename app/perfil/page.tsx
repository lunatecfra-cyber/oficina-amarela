import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { ROTULO_FORMATO } from "@/lib/pautas";
import { PERFIL_EDITOR, progressoNivel } from "@/lib/perfil";
import { DIAS, DISPONIBILIDADE_PADRAO, PERIODOS, trabalhoDaPauta } from "@/lib/agenda";
import { pautaReservadaPor } from "@/lib/pautas-db";
import { lerOnboardingEditor } from "@/lib/perfil-db";
import { MesaAgora } from "@/components/mesa-agora";
import { Stat } from "@/components/stat";
import { Card } from "@/components/card";
import { CelulaDisponibilidade } from "@/components/disponibilidade-cell";
import { iniciais } from "@/lib/candidatos";
import { lerPerfilEditor } from "@/lib/perfil-db";
import { exigirSessao } from "@/lib/sessao-servidor";

export const metadata: Metadata = { title: "Meu Perfil — Oficina Amarela" };

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const sessao = await exigirSessao();
  const [doBanco, onboarding, reservada] = await Promise.all([
    lerPerfilEditor(sessao.id),
    lerOnboardingEditor(sessao.id),
    pautaReservadaPor(sessao.id),
  ]);

  // Perfil real do banco. PERFIL_EDITOR só entra como último recurso (conta
  // recém-criada não tem nada preenchido, e a tela ficaria vazia demais).
  const p = doBanco ?? PERFIL_EDITOR;
  const nivel = progressoNivel(p.entregues);

  // a grade que o editor salvou no cadastro (a /agenda já lia daqui; esta
  // tela mostrava a grade fake e contradizia a outra)
  const grade = onboarding?.disponibilidade?.length
    ? onboarding.disponibilidade
    : DISPONIBILIDADE_PADRAO;
  const livres = grade.flat().filter(Boolean).length;

  // missão que ele tem em mãos agora, de verdade
  const naMesa = trabalhoDaPauta(reservada);

  const temBancada =
    p.softwares.length > 0 ||
    p.estilos.length > 0 ||
    p.nicho.length > 0 ||
    !!p.nivelEdicao ||
    !!p.setupPc;

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
          {/* ---- cartão de identidade ---- */}
          <section className="reveal overflow-hidden rounded-2xl border border-line bg-surface/60">
            {/* capa */}
            <div className="relative h-32 lg:h-44">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 160% at 15% 0%, rgba(244,206,31,0.22), transparent 55%), linear-gradient(120deg,#17140a,#0e0e12 60%,#0a0a0b)",
                }}
              />
              <Image
                src="/emblema.png"
                alt=""
                aria-hidden="true"
                width={365}
                height={365}
                className="pointer-events-none absolute -right-4 top-1/2 w-40 -translate-y-1/2 opacity-[0.08] lg:w-56"
              />
              <div className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_6px)]" />
            </div>

            {/* cabeçalho */}
            <div className="px-5 pb-6 lg:px-8">
              <div className="relative z-10 -mt-12 flex items-end justify-between gap-4 lg:-mt-14">
                {/* a foto vem do onboarding. Antes o perfil mostrava as
                    iniciais mesmo quando ela existia no banco. */}
                <div
                  className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl bg-ink font-[family-name:var(--font-display)] text-3xl font-semibold text-gold lg:h-28 lg:w-28 lg:text-4xl"
                  style={{
                    boxShadow:
                      "0 0 0 4px var(--color-ink), 0 0 0 5px rgba(244,206,31,0.55), 0 12px 34px rgba(0,0,0,0.6)",
                  }}
                >
                  {p.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URL do upload, next/image não otimiza
                    <img
                      src={p.fotoUrl}
                      alt={p.nome}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    iniciais(p.nome)
                  )}
                </div>
                <Link href="/perfil/editar" className="btn-ghost mb-1 w-auto px-4 text-sm">
                  Editar perfil
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
                  {p.nome}
                </h1>
                <span className="rounded-full border border-gold-lo/60 bg-gold/10 px-3 py-0.5 text-xs font-medium text-gold-hi">
                  {nivel.atual.nome}
                </span>
              </div>
              <p className="mt-1 text-muted">{p.headline.join(" · ")}</p>
              <p className="mt-1 text-sm text-muted-2">
                {/* sem cidade preenchida sairia "@apelido · · na guilda" */}
                @{p.apelido} {p.local && <>· {p.local} </>}· na guilda desde{" "}
                {p.desde}
              </p>

              {/* stats */}
              {/* Grade de 2 no celular. Com `flex-wrap`, os quatro números
                  caíam três numa linha e "ritmo da forja" sobrava sozinho
                  embaixo, torto. Grade fixa dá duas colunas parelhas; da
                  largura de tablet em diante volta a ser uma linha só. */}
              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
                <Stat valor={String(p.entregues)} rotulo="entregues" />
                <Stat
                  valor={p.nota === null ? "—" : p.nota.toFixed(1).replace(".", ",")}
                  rotulo={p.nota === null ? "sem nota ainda" : "nota"}
                  estrela
                />
                <Stat valor={String(p.reputacao)} rotulo="XP" />
                <Stat valor={String(p.streak)} rotulo="ritmo da forja" fogo />
              </dl>
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            {/* ---- coluna principal ---- */}
            <div className="flex flex-col gap-6">
              <Card titulo="Sobre" delay={0.05}>
                {p.bio ? (
                  <p className="text-[15px] leading-relaxed text-muted">{p.bio}</p>
                ) : (
                  <p className="text-sm text-muted-2">
                    Você ainda não escreveu sua bio.{" "}
                    <Link href="/perfil/editar" className="text-gold-hi hover:underline">
                      Escrever agora
                    </Link>
                  </p>
                )}
              </Card>

              <Card titulo="Portfólio" delay={0.1} guia="cartao-portfolio">
                {p.portfolio.length === 0 && (
                  <p className="text-sm text-muted-2">
                    Seu portfólio se preenche sozinho: cada entrega aprovada
                    entra aqui.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {p.portfolio.map((v) => (
                    <figure key={v.id} className="group">
                      <div
                        className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl border border-line"
                        style={{ background: v.tint }}
                      >
                        <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/5" />
                        <svg
                          viewBox="0 0 24 24"
                          className="relative h-8 w-8 text-white/90 drop-shadow"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span className="absolute left-2 top-2 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                          {ROTULO_FORMATO[v.formato]}
                        </span>
                      </div>
                      <figcaption className="mt-2">
                        <p className="truncate text-sm font-medium text-text">{v.titulo}</p>
                        <p className="text-xs text-muted-2">{v.portaVoz}</p>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </Card>

              <Card titulo="Histórico" delay={0.15}>
                <ol className="relative ml-1">
                  {p.historico.map((h, i) => {
                    const ok = h.resultado === "aprovada";
                    const ultimo = i === p.historico.length - 1;
                    return (
                      <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
                        {!ultimo && (
                          <span className="absolute left-[7px] top-4 h-full w-px bg-line" />
                        )}
                        <span
                          className={`relative mt-1 h-3.5 w-3.5 flex-none rounded-full border-2 ${
                            ok
                              ? "border-ok bg-ok/30"
                              : "border-gold bg-gold/30"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text">{h.titulo}</p>
                          <p className="text-xs text-muted-2">
                            {h.portaVoz} · {h.data} ·{" "}
                            <span className={ok ? "text-ok" : "text-gold"}>
                              {ok ? "aprovada" : "reedição"}
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </Card>
            </div>

            {/* ---- sidebar ---- */}
            <aside className="flex flex-col gap-6">
              <Card titulo="Nível" delay={0.1} guia="cartao-nivel">
                <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-gold-hi">
                  {nivel.atual.nome}
                </p>
                {nivel.proximo ? (
                  <>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi"
                        style={{ width: `${nivel.pct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Faltam <b className="text-text">{nivel.faltam}</b> entregas pra{" "}
                      <b className="text-gold-hi">{nivel.proximo.nome}</b>
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-muted">Nível máximo alcançado. 🐆</p>
                )}
              </Card>

              {/* "A Bancada" é o nome da etapa do cadastro onde ele preencheu
                  isto. Antes o card se chamava "Caixa de Ferramentas" e
                  mostrava conquistas — as ferramentas de verdade estavam no
                  banco e não apareciam em lugar nenhum. */}
              <Card titulo="A Bancada" delay={0.15}>
                {temBancada ? (
                  <div className="flex flex-col gap-4">
                    {p.softwares.length > 0 && (
                      <ListaChips titulo="Softwares" itens={p.softwares} />
                    )}
                    {p.estilos.length > 0 && (
                      <ListaChips titulo="Estilos" itens={p.estilos} />
                    )}
                    {p.nicho.length > 0 && (
                      <ListaChips titulo="Formato" itens={p.nicho} />
                    )}
                    {(p.nivelEdicao || p.setupPc) && (
                      <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-3">
                        {p.nivelEdicao && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-2">
                              Nível de edição
                            </p>
                            <p className="mt-0.5 text-sm text-text">{p.nivelEdicao}</p>
                          </div>
                        )}
                        {p.setupPc && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-2">
                              Setup
                            </p>
                            <p className="mt-0.5 text-sm text-text">{p.setupPc}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-2">
                    Você ainda não montou sua bancada.{" "}
                    <Link
                      href="/editor/criar-perfil"
                      className="text-gold-hi hover:underline"
                    >
                      Preencher agora
                    </Link>
                  </p>
                )}
              </Card>

              <Card titulo="Conquistas" delay={0.18}>
                {p.conquistas.length === 0 ? (
                  <p className="text-sm text-muted-2">
                    Nenhuma conquista ainda. Elas vêm com as entregas.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {p.conquistas.map((c) => (
                      <li key={c.nome} className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-ink-2 text-lg">
                          {c.icone}
                        </span>
                        <span className="text-sm text-muted">{c.nome}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card titulo="Disponibilidade" delay={0.2}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-text">
                    <b className="text-gold-hi">{livres}</b> blocos livres
                  </span>
                  <Link href="/agenda" className="text-xs text-muted transition-colors hover:text-gold-hi">
                    Editar →
                  </Link>
                </div>
                <MiniGrade grade={grade} />
              </Card>

              <Card titulo="Na mesa agora" delay={0.25}>
                <MesaAgora trabalhos={naMesa} variant="lista" />
              </Card>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}

function ListaChips({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-2">{titulo}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {itens.map((i) => (
          <span
            key={i}
            className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-xs text-muted"
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function MiniGrade({ grade }: { grade: boolean[][] }) {
  return (
    <div className="grid grid-cols-[18px_repeat(7,1fr)] gap-1">
      <span />
      {DIAS.map((d) => (
        <span key={d} className="text-center text-[10px] text-muted-2">
          {d[0]}
        </span>
      ))}
      {PERIODOS.map((periodo, pi) => (
        <div key={periodo} className="contents">
          <span className="flex items-center text-[10px] text-muted-2">
            {periodo[0]}
          </span>
          {DIAS.map((d, di) => (
            <CelulaDisponibilidade
              key={d}
              size="mini"
              livre={grade[pi][di]}
              label={`${periodo} de ${d}: ${grade[pi][di] ? "livre" : "ocupado"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
