import { type Candidate, getCandidateBySlug } from "@oficina/domain/candidates";
import { FORMAT_LABELS, MISSIONS, type Mission, STATUS_LABELS } from "@oficina/domain/missions";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CandidateAvatar } from "@/components/candidate-avatar";
import { CandidateData } from "@/components/candidate-data";
import { CandidateName } from "@/components/candidate-name";
import { Stat } from "@/components/stat";
import { readPublicCandidate } from "@/lib/candidate-db";
import { isDemoContentEnabled } from "@/lib/dev-mode";
import { publicCandidateMissions } from "@/lib/missions-db";
import { readSession } from "@/lib/server-session";

async function fetchCandidate(slug: string): Promise<Candidate | null> {
  return getCandidateBySlug(slug) ?? (await readPublicCandidate(slug));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cand = await fetchCandidate(slug);
  const name = cand?.name ?? (cand as any)?.nome;
  return { title: cand ? `${name} — Oficina Amarela` : "Oficina Amarela" };
}

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [cand, session] = await Promise.all([fetchCandidate(slug), readSession()]);
  if (!cand) notFound();

  const DEMO_MODE = isDemoContentEnabled();
  const name = cand.name ?? (cand as any).nome;

  const missions: Mission[] = DEMO_MODE
    ? MISSIONS.filter((p) => (p.spokesperson ?? (p as any).portaVoz) === name)
    : await publicCandidateMissions(slug);

  const inQueue = missions.filter(
    (p) => p.status === "available" || (p as any).status === "disponivel",
  ).length;
  const inProgress = missions.filter((p) =>
    [
      "reserved",
      "reservada",
      "mine",
      "minha",
      "in_review",
      "em_revisao",
      "reedit",
      "reedicao",
    ].includes(p.status),
  ).length;

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
          <Link
            href={session ? "/editor" : "/"}
            className="text-sm text-muted transition-colors hover:text-silver-hi"
          >
            {session ? "← Fila" : "← Início"}
          </Link>

          <section className="reveal mt-4 overflow-hidden rounded-2xl border border-line bg-surface/60">
            <div className="relative h-28 lg:h-36">
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(120% 160% at 15% 0%, rgba(244,206,31,0.20), transparent 55%), linear-gradient(120deg,#17140a,#0e0e12 60%,#0a0a0b)",
                }}
              />
              <Image
                src="/emblema.png"
                alt=""
                aria-hidden="true"
                width={365}
                height={365}
                className="pointer-events-none absolute -right-4 top-1/2 w-36 -translate-y-1/2 opacity-[0.08] lg:w-48"
              />
            </div>

            <div className="px-5 pb-6 lg:px-8">
              <div className="relative z-10 -mt-12 flex items-end gap-4">
                <CandidateAvatar candidate={cand} className="h-24 w-24 text-3xl" />
              </div>

              <CandidateName
                candidate={cand}
                className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl"
              />
              <CandidateData candidate={cand} />
              <p className="mt-1 text-[11px] text-muted-2">
                <span className="text-gold-hi">●</span> perto de você ·{" "}
                <span className="text-[#5a5a64]">●</span> longe
              </p>

              <dl className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8">
                <Stat valor={String(missions.length)} rotulo="missões" />
                <Stat valor={String(inQueue)} rotulo="na fila" />
                <Stat valor={String(inProgress)} rotulo="em produção" />
              </dl>
            </div>
          </section>

          <section
            className="reveal mt-6 rounded-2xl border border-line bg-surface/60 p-5 lg:p-6"
            style={{ animationDelay: "0.05s" }}
          >
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-gold">
              Missões de {name}
            </h2>
            {missions.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma missão ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {missions.map((p) => {
                  const title = p.title ?? (p as any).titulo;
                  const format = p.format ?? (p as any).formato;
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
                        <p className="mt-0.5 text-xs text-muted-2">
                          {FORMAT_LABELS[format as keyof typeof FORMAT_LABELS] ?? format}
                        </p>
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
          </section>
        </div>
      </main>
    </>
  );
}
