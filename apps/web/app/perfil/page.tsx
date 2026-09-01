import { initials } from "@oficina/domain/candidates";
import { FORMAT_LABEL } from "@oficina/domain/missions";
import { DEFAULT_EDITOR_PROFILE, levelProgress } from "@oficina/domain/profile";
import {
  activeWorkFromMission,
  DAYS,
  DEFAULT_AVAILABILITY,
  PERIODS,
} from "@oficina/domain/schedule";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ActiveDesk } from "@/components/active-desk";
import { AppHeader } from "@/components/app-header";
import { AvailabilityCell } from "@/components/availability-cell";
import { Card } from "@/components/card";
import { EditorInvitation } from "@/components/editor-invitation";
import { ElectoralProgress } from "@/components/electoral-progress";
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
  const since = p.since ?? (p as any).desde;
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
        <div className="mx-auto w-full max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
          <section className="reveal overflow-hidden rounded-2xl border border-line bg-surface/60">
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

            <div className="px-5 pb-6 lg:px-8">
              <div className="relative z-10 -mt-12 flex items-end justify-between gap-4 lg:-mt-14">
                <div
                  className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl bg-ink font-[family-name:var(--font-display)] text-3xl font-semibold text-gold lg:h-28 lg:w-28 lg:text-4xl"
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
                <Link href="/perfil/editar" className="btn-ghost mb-1 w-auto px-4 text-sm">
                  Editar perfil
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
                  {name}
                </h1>
                <span className="rounded-full border border-gold-lo/60 bg-gold/10 px-3 py-0.5 text-xs font-medium text-gold-hi">
                  {level.current.name ?? (level.current as any).nome}
                </span>
              </div>
              <p className="mt-1 text-muted">{p.headline.join(" · ")}</p>
              <p className="mt-1 text-sm text-muted-2">
                @{handle} {location && <>· {location} </>}· na guilda desde {since}
              </p>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
                <Stat valor={String(deliveries)} rotulo="entregues" />
                <Stat
                  valor={
                    rating === null || rating === undefined
                      ? "—"
                      : Number(rating).toFixed(1).replace(".", ",")
                  }
                  rotulo={rating === null || rating === undefined ? "sem nota ainda" : "nota"}
                  estrela
                />
                <Stat valor={String(reputation)} rotulo="XP" />
                <Stat valor={String(streak)} rotulo="ritmo da forja" fogo />
              </dl>
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.7fr_1fr]">
            <div className="flex flex-col gap-6">
              <Card title="Sobre" delay={0.05}>
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

              <Card title="Portfólio" delay={0.1} guide="cartao-portfolio">
                {portfolio.length === 0 && (
                  <p className="text-sm text-muted-2">
                    Seu portfólio se preenche sozinho: cada entrega aprovada entra aqui.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {portfolio.map((v: any) => (
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
                  className="mt-4 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-gold-hi hover:underline"
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
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-line">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi"
                        style={{ width: `${level.pct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted">
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
                      <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-3">
                        {editingLevel && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-2">
                              Nível de edição
                            </p>
                            <p className="mt-0.5 text-sm text-text">{editingLevel}</p>
                          </div>
                        )}
                        {pcSetup && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wide text-muted-2">
                              Setup
                            </p>
                            <p className="mt-0.5 text-sm text-text">{pcSetup}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-2">
                    Você ainda não montou sua bancada.{" "}
                    <Link href="/editor/criar-perfil" className="text-gold-hi hover:underline">
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
                        <span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-ink-2 text-lg">
                          {c.icon ?? c.icone}
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
        </div>
      </main>
    </>
  );
}

function ChipList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-2">{title}</p>
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
        <span key={d} className="text-center text-[10px] text-muted-2">
          {d[0]}
        </span>
      ))}
      {PERIODS.map((period, pi) => (
        <div key={period} className="contents">
          <span className="flex items-center text-[10px] text-muted-2">{period[0]}</span>
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
