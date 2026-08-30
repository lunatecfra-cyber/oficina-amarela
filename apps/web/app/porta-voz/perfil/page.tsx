import { isDemoContentEnabled } from "@oficina/config/dev-mode";
import { getCandidate } from "@oficina/domain/candidates";
import { MISSIONS, STATUS_LABELS } from "@oficina/domain/missions";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { CandidateData } from "@/components/candidate-data";
import { CandidateName } from "@/components/candidate-name";
import { Card } from "@/components/card";
import { Stat } from "@/components/stat";
import { readOwnCandidate } from "@/lib/candidate-db";
import { spokespersonMissions } from "@/lib/missions-db";
import { requireSession } from "@/lib/server-session";

export const metadata: Metadata = { title: "Meu Perfil — Oficina Amarela" };
export const dynamic = "force-dynamic";

export default async function SpokespersonProfilePage() {
  const session = await requireSession();

  const [candOpt, realMine] = await Promise.all([
    readOwnCandidate(session.id),
    spokespersonMissions(session.id),
  ]);
  const cand = candOpt ?? getCandidate(session.name);

  const demo = isDemoContentEnabled()
    ? MISSIONS.filter((p) => (p.spokesperson ?? (p as any).portaVoz) === session.name)
    : [];
  const myMissions = [...realMine, ...demo];

  const inQueue = myMissions.filter((p) =>
    ["available", "disponivel", "offered", "oferecida"].includes(p.status),
  ).length;
  const inProduction = myMissions.filter((p) =>
    ["reserved", "reservada", "in_review", "em_revisao", "reedit", "reedicao"].includes(p.status),
  ).length;
  const ready = myMissions.filter((p) =>
    ["approved", "aprovada", "finished", "finalizada"].includes(p.status),
  ).length;

  const history = myMissions.filter((p) =>
    ["approved", "aprovada", "finished", "finalizada", "reedit", "reedicao"].includes(p.status),
  );

  return (
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
            <CandidateAvatar
              candidate={cand}
              className="h-24 w-24 text-3xl lg:h-28 lg:w-28 lg:text-4xl"
            />
            <Link
              href="/porta-voz/perfil/editar"
              className="btn-ghost mb-1 w-auto px-4 text-sm"
              data-guia="editar-perfil"
            >
              Editar perfil
            </Link>
          </div>

          <CandidateName
            candidate={cand}
            className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl"
          />
          <CandidateData candidate={cand} />
          {cand.since && <p className="mt-1 text-sm text-muted-2">na guilda desde {cand.since}</p>}

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
            <Stat valor={String(myMissions.length)} rotulo="missões" />
            <Stat valor={String(inQueue)} rotulo="na fila" />
            <Stat valor={String(inProduction)} rotulo="em produção" />
            <Stat valor={String(ready)} rotulo="prontas" />
          </dl>
        </div>
      </section>

      <div className="mt-6 flex flex-col gap-6">
        <Card title="Missões criadas">
          {myMissions.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma missão criada ainda.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {myMissions.map((p) => {
                const title = p.title ?? (p as any).titulo;
                const reservedBy = p.reservedBy ?? (p as any).reservadaPor;
                const status = p.status;
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface/40 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                        {title}
                      </h3>
                      {reservedBy && (
                        <p className="mt-0.5 text-xs text-muted-2">editor: {reservedBy}</p>
                      )}
                    </div>
                    <span className="rounded-full border border-line bg-ink-2 px-3 py-1 text-xs text-muted">
                      {STATUS_LABELS[status as keyof typeof STATUS_LABELS] ??
                        (STATUS_LABELS as any)[status] ??
                        status}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Histórico" delay={0.05}>
          {history.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma missão concluída ainda.</p>
          ) : (
            <ol className="relative ml-1">
              {history.map((h, i) => {
                const ok =
                  h.status === "approved" ||
                  (h.status as any) === "aprovada" ||
                  h.status === "finished" ||
                  (h.status as any) === "finalizada";
                const isLast = i === history.length - 1;
                const title = h.title ?? (h as any).titulo;
                const reservedBy = h.reservedBy ?? (h as any).reservadaPor;

                return (
                  <li key={h.id} className="relative flex gap-4 pb-5 last:pb-0">
                    {!isLast && <span className="absolute left-[7px] top-4 h-full w-px bg-line" />}
                    <span
                      className={`relative mt-1 h-3.5 w-3.5 flex-none rounded-full border-2 ${
                        ok ? "border-ok bg-ok/30" : "border-gold bg-gold/30"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">{title}</p>
                      <p className="text-xs text-muted-2">
                        {reservedBy ?? "—"} ·{" "}
                        <span className={ok ? "text-ok" : "text-gold"}>
                          {h.status === "finished" || (h.status as any) === "finalizada"
                            ? "concluída"
                            : h.status === "approved" || (h.status as any) === "aprovada"
                              ? "pronta pra conferir"
                              : "reedição pedida"}
                        </span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
