import { initials } from "@oficina/domain/candidates";
import { FORMAT_LABEL } from "@oficina/domain/missions";
import { DEFAULT_EDITOR_PROFILE, levelProgress } from "@oficina/domain/profile";
import {
  activeWorkFromMission,
  DAYS,
  DEFAULT_AVAILABILITY,
  PERIODS,
} from "@oficina/domain/schedule";
import { Play } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ActiveDesk } from "@/components/active-desk";
import { AppHeader } from "@/components/app-header";
import { AvailabilityCell } from "@/components/availability-cell";
import { Card } from "@/components/card";
import { EditorDirectoryConsent } from "@/components/editor-directory-consent";
import { EditorInvitation } from "@/components/editor-invitation";
import { ElectoralProgress } from "@/components/electoral-progress";
import { EmojiIcon, EmojiLead } from "@/components/emoji-icon";
import { Stat } from "@/components/stat";
import { getEditorProgress } from "@/lib/electoral-ranking-db";
import { getReservedMission } from "@/lib/missions-db";
import { readEditorOnboarding, readEditorProfile } from "@/lib/profile-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Meu Perfil — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await requireSession();
  const [dbProfile, onboarding, reserved, electoralProgress] = await Promise.all([
    readEditorProfile(session.id),
    readEditorOnboarding(session.id),
    getReservedMission(session.id),
    getEditorProgress(session.id),
  ]);

  const p = dbProfile ?? DEFAULT_EDITOR_PROFILE;
  const level = levelProgress(p.deliveries ?? (p as any).entregues ?? 0);

  const grid = onboarding?.availability?.length ? onboarding.availability : DEFAULT_AVAILABILITY;
  const freeSlots = grid.flat().filter(Boolean).length;

  const onDesk = activeWorkFromMission(reserved);

  const softwares = p.softwares ?? [];
  const styles = p.styles ?? (p as any).estilos ?? [];
  const niche = p.niche ?? (p as any).nicho ?? [];
  const editingLevel = p.editingLevel ?? (p as any).nivelEdicao;
  const pcSetup = p.pcSetup ?? (p as any).setupPc;
  const photoUrl = p.photoUrl ?? (p as any).fotoUrl;
  const name = p.name ?? (p as any).nome;
  const handle = p.handle ?? (p as any).apelido;
  const location = p.location ?? (p as any).local ?? (p as any).localizacao;
  const rawSince = p.since ?? (p as any).desde;
  /* Data ausente chega como época (janeiro de 1970): mostrar "recém-chegado"
     em vez de uma data que nunca aconteceu. */
  const sinceText = rawSince && !/1970/.test(String(rawSince)) ? String(rawSince) : null;
  const deliveries = p.deliveries ?? (p as any).entregues ?? 0;
  const rating = p.rating ?? (p as any).nota;
  const reputation = p.reputation ?? (p as any).reputacao ?? 0;
  const streak = p.streak ?? 0;
  const portfolio = p.portfolio ?? [];
  const history = p.history ?? (p as any).historico ?? [];
  const achievements = p.achievements ?? (p as any).conquistas ?? [];

  const hasDesk =
    softwares.length > 0 || styles.length > 0 || niche.length > 0 || !!editingLevel || !!pcSetup;

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-10">
          <section className="reveal overflow-hidden rounded-2xl border border-line-soft bg-surface/80 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_18px_48px_rgba(0,0,0,0.45)]">
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
                className="pointer-events-none absolute -right-4 top-1/2 w-40 -translate-y-1/2 opacity-[0.14] [mask-image:radial-gradient(75%_90%_at_60%_50%,black,transparent)] lg:w-56"
              />
              <div className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(135deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_6px)]" />
              {/* O banner derrete no corpo do card: antes ele cortava seco e o
                  avatar flutuava sobre a emenda. */}
              <div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface/90 to-transparent"
              />
            </div>

            <div className="px-5 pb-6 lg:px-8">
              <div className="relative z-10 -mt-12 flex items-end justify-between gap-4 lg:-mt-14">
                <div
                  className="grid h-24 w-24 flex-none place-items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-surface-2 to-ink font-[family-name:var(--font-display)] text-3xl font-semibold text-gold lg:h-28 lg:w-28 lg:text-4xl"
                  style={{
                    boxShadow:
                      "0 0 0 4px var(--color-ink), 0 0 0 5px rgba(244,206,31,0.55), 0 12px 34px rgba(0,0,0,0.6)",
                  }}
                >
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    initials(name)
                  )}
                </div>
                <Link
                  href="/perfil/editar"
                  className="btn-ghost mb-1 w-auto flex-none px-5 text-sm"
                >
                  Editar perfil
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-balance font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
                  {name}
                </h1>
                <span className="flex-none rounded-full border border-gold-lo/60 bg-gold/10 px-3 py-0.5 text-xs font-medium text-gold-hi">
                  {level.current.name ?? (level.current as any).nome}
                </span>
              </div>
              <p className="mt-1.5 text-[15px] text-silver/80">{p.headline.join(" · ")}</p>
              <p className="mt-1 text-sm text-muted-2">
                @{handle} {location && <>· {location} </>}·{" "}
                {sinceText ? <>na guilda desde {sinceText}</> : <>recém-chegado à guilda</>}
              </p>

              {/* Filete + respiro antes dos números: antes eles colavam na
                  identidade e liam como continuação do nome. */}
              <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line-soft pt-5 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
                <Stat valor={String(deliveries)} rotulo="entregues" />
                <Stat
                  valor={
                    rating === null || rating === undefined
                      ? "—"
                      : Number(rating).toFixed(1).replace(".", ",")
                  }
                  rotulo={
                    rating === null || rating === undefined
                      ? "sem avaliações"
                      : p.ratingCount === undefined
                        ? "nota"
                        : `${p.ratingCount} ${p.ratingCount === 1 ? "avaliação" : "avaliações"}`
                  }
                  estrela
                />
                <Stat valor={String(reputation)} rotulo="XP" />
                <Stat valor={String(streak)} rotulo="ritmo da forja" fogo />
              </div>
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <div className="flex flex-col gap-6">
              <Card title="Sobre" delay={0.05}>
                {p.bio ? (
                  <p className="max-w-xl text-[15px] leading-relaxed text-muted">{p.bio}</p>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-2">
                    Você ainda não escreveu sua bio.{" "}
                    {/* Link solto nasce com ~20px de altura e o dedo erra
                        (DESIGN §2): área de toque de 44px sem mexer no desenho. */}
                    <Link
                      href="/perfil/editar"
                      className="inline-flex min-h-11 items-center text-gold-hi underline-offset-4 hover:underline"
                    >
                      Escrever agora
                    </Link>
                  </p>
                )}
              </Card>

              <Card title="Portfólio" delay={0.1} guide="cartao-portfolio">
                {portfolio.length === 0 ? (
                  /* Vazio com convite: antes era uma frase solta que lia como
                     beco sem saída. A área tracejada mostra onde as entregas
                     vão morar e o botão dá o próximo passo. */
                  <div className="rounded-xl border border-dashed border-line px-4 py-7 text-center">
                    <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-2">
                      Seu portfólio se preenche sozinho: cada entrega aprovada entra aqui.
                    </p>
                    <Link href="/editor" className="btn-ghost mt-4 inline-flex w-auto px-5 text-sm">
                      Ver a fila de missões
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {portfolio.map((v: any) => (
                      <figure key={v.id} className="group">
                        <div
                          className="relative flex aspect-[16/10] items-center justify-center overflow-hidden rounded-xl border border-line-soft transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-gold-lo/40 group-hover:shadow-[0_10px_28px_rgba(0,0,0,0.5)] group-focus-within:border-gold-lo/40"
                          style={{ background: v.tint }}
                        >
                          <span className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/5" />
                          <Play
                            className="relative h-8 w-8 text-white/90 drop-shadow"
                            fill="currentColor"
                            aria-hidden="true"
                          />
                          <span className="absolute left-2 top-2 rounded bg-black/45 px-1.5 py-0.5 text-xs font-medium text-white/90">
                            {FORMAT_LABEL[v.format as keyof typeof FORMAT_LABEL] ??
                              (FORMAT_LABEL as any)[v.formato] ??
                              v.format}
                          </span>
                        </div>
                        <figcaption className="mt-2">
                          <p className="truncate text-sm font-medium text-text">
                            {v.title ?? v.titulo}
                          </p>
                          <p className="text-xs text-muted-2">{v.spokesperson ?? v.portaVoz}</p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </Card>

              <Card title="Histórico" delay={0.15}>
                <ol className="relative ml-1">
                  {history.map((h: any, i: number) => {
                    const res = h.result ?? h.resultado;
                    const ok = res === "approved" || res === "aprovada";
                    const isLast = i === history.length - 1;
                    return (
                      <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
                        {!isLast && (
                          <span className="absolute left-[7px] top-4 h-full w-px bg-line" />
                        )}
                        <span
                          className={`relative mt-1 h-3.5 w-3.5 flex-none rounded-full border-2 ${
                            ok ? "border-ok bg-ok/30" : "border-gold bg-gold/30"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text">{h.title ?? h.titulo}</p>
                          <p className="text-xs text-muted-2">
                            {h.spokesperson ?? h.portaVoz} · {h.date ?? h.data} ·{" "}
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

            <aside className="flex flex-col gap-6">
              <Card title="Meta eleitoral" delay={0.08}>
                <ElectoralProgress
                  weeks={electoralProgress.weeks}
                  sequence={electoralProgress.sequence}
                  shields={electoralProgress.shields}
                  eligibleForDraw={electoralProgress.eligibleForDraw}
                />

                <Link
                  href="/ranking"
                  className="mt-4 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-gold-hi underline-offset-4 hover:underline"
                >
                  Ver o ranking do ciclo
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M5 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>

                {electoralProgress.referralCode && (
                  <div className="mt-4 border-t border-line-soft pt-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-[0.1em] text-muted-2">
                      Convite de editor
                    </p>
                    <EditorInvitation code={String(electoralProgress.referralCode)} />
                  </div>
                )}
              </Card>

              <Card title="Nível" delay={0.1} guide="cartao-nivel">
                <p className="font-[family-name:var(--font-display)] text-2xl font-semibold text-gold-hi">
                  {level.current.name ?? (level.current as any).nome}
                </p>
                {level.next ? (
                  <>
                    {/* Trilho com anel interno: em 0% a barra vazia ainda lê
                        como trilho, não como espaço quebrado. */}
                    <div
                      role="progressbar"
                      aria-label={`Progresso para ${level.next.name ?? (level.next as any).nome}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(level.pct)}
                      className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/10"
                    >
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi shadow-[0_0_12px_rgba(244,206,31,0.35)]"
                        style={{ width: `${level.pct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs tabular-nums text-muted">
                      Faltam <b className="text-text">{level.remaining}</b> entregas pra{" "}
                      <b className="text-gold-hi">{level.next.name ?? (level.next as any).nome}</b>
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-muted">Nível máximo alcançado. 🐆</p>
                )}
              </Card>

              <Card title="A Bancada" delay={0.15}>
                {hasDesk ? (
                  <div className="flex flex-col gap-4">
                    {softwares.length > 0 && <ChipList title="Softwares" items={softwares} />}
                    {styles.length > 0 && <ChipList title="Estilos" items={styles} />}
                    {niche.length > 0 && <ChipList title="Formato" items={niche} />}
                    {(editingLevel || pcSetup) && (
                      <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line-soft pt-4">
                        {editingLevel && (
                          <div>
                            <p className="text-xs uppercase tracking-[0.08em] text-muted-2">
                              Nível de edição
                            </p>
                            <p className="mt-1 text-sm text-text">{editingLevel}</p>
                          </div>
                        )}
                        {pcSetup && (
                          <div>
                            <p className="text-xs uppercase tracking-[0.08em] text-muted-2">
                              Setup
                            </p>
                            <div className="mt-1 text-sm text-text">
                              <EmojiLead text={pcSetup} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-muted-2">
                    Você ainda não montou sua bancada.{" "}
                    <Link
                      href="/editor/criar-perfil"
                      className="inline-flex min-h-11 items-center text-gold-hi underline-offset-4 hover:underline"
                    >
                      Preencher agora
                    </Link>
                  </p>
                )}
              </Card>

              <Card title="Conquistas" delay={0.18}>
                {achievements.length === 0 ? (
                  <p className="text-sm text-muted-2">
                    Nenhuma conquista ainda. Elas vêm com as entregas.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {achievements.map((c: any) => (
                      <li key={c.name ?? c.nome} className="flex items-center gap-3">
                        <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border border-line bg-ink-2 text-gold">
                          <EmojiIcon value={c.icon ?? c.icone} className="h-5 w-5" />
                        </span>
                        <span className="text-sm text-muted">{c.name ?? c.nome}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card title="Disponibilidade" delay={0.2}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm text-text">
                    <b className="text-gold-hi">{freeSlots}</b> blocos livres
                  </span>
                  {/* tap-target: o alvo estava em 16px de altura */}
                  <Link
                    href="/agenda"
                    className="tap-target -mr-3 text-xs text-muted hover:text-gold-hi"
                  >
                    Editar →
                  </Link>
                </div>
                <MiniGrid grid={grid} />
              </Card>

              <Card title="Na mesa agora" delay={0.25}>
                <ActiveDesk tasks={onDesk} variant="list" />
              </Card>
            </aside>
          </div>
          <EditorDirectoryConsent />
        </div>
      </main>
    </>
  );
}

function ChipList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-muted-2">{title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {items.map((i) => (
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

function MiniGrid({ grid }: { grid: boolean[][] }) {
  return (
    <div className="grid grid-cols-[18px_repeat(7,1fr)] gap-1">
      <span />
      {DAYS.map((d) => (
        <span key={d} className="text-center text-xs font-medium text-muted-2">
          {d[0]}
        </span>
      ))}
      {PERIODS.map((period, pi) => (
        <div key={period} className="contents">
          <span className="flex items-center text-xs font-medium text-muted-2">{period[0]}</span>
          {DAYS.map((d, di) => (
            <AvailabilityCell
              key={d}
              size="mini"
              free={grid[pi][di]}
              label={`${period} de ${d}: ${grid[pi][di] ? "livre" : "ocupado"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
