import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PAUTAS, ROTULO_FORMATO, ROTULO_STATUS, type Pauta } from "@/lib/pautas";
import { getCandidatoPorSlug, type Candidato } from "@/lib/candidatos";
import { lerCandidatoPublico } from "@/lib/candidato-db";
import { pautasDoCandidatoPublico } from "@/lib/pautas-db";
import { Stat } from "@/components/stat";
import { AvatarCandidato } from "@/components/avatar-candidato";
import { DadosCandidato } from "@/components/dados-candidato";
import { NomeCandidato } from "@/components/nome-candidato";
import { lerSessao } from "@/lib/sessao-servidor";

// os 2 candidatos fake de demonstração primeiro (têm slug fixo), senão
// procura no banco por apelido — apelido já é único e URL-safe, dobra de slug
async function buscarCandidato(slug: string): Promise<Candidato | null> {
  return getCandidatoPorSlug(slug) ?? (await lerCandidatoPublico(slug));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const cand = await buscarCandidato(slug);
  return { title: cand ? `${cand.nome} — Oficina Amarela` : "Oficina Amarela" };
}

export default async function CandidatoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [cand, sessao] = await Promise.all([
    buscarCandidato(slug),
    // a página é pública, então a sessão pode não existir — serve só pra
    // decidir o link de volta e o cabeçalho
    lerSessao(),
  ]);
  if (!cand) notFound();

  const MODO_DEMO = process.env.NODE_ENV !== "production";

  // em produção, busca pautas reais no banco; em dev, usa dados de demonstração
  const pautas: Pauta[] = MODO_DEMO
    ? PAUTAS.filter((p) => p.portaVoz === cand.nome)
    : await pautasDoCandidatoPublico(slug);

  const naFila = pautas.filter((p) => p.status === "disponivel").length;
  const emAndamento = pautas.filter((p) =>
    ["reservada", "minha", "em_revisao", "reedicao"].includes(p.status)
  ).length;

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 lg:px-8 lg:py-10">
          {/* Esta página é pública. O link de volta apontava fixo pra /editor,
              que é rota protegida: um visitante clicava e caía no login sem
              entender por quê. Agora depende de quem está olhando. */}
          <Link
            href={sessao ? "/editor" : "/"}
            className="text-sm text-muted transition-colors hover:text-silver-hi"
          >
            {sessao ? "← Fila" : "← Início"}
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
                <AvatarCandidato candidato={cand} className="h-24 w-24 text-3xl" />
              </div>

              <NomeCandidato
                candidato={cand}
                className="mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl"
              />
              <DadosCandidato candidato={cand} />
              <p className="mt-1 text-[11px] text-muted-2">
                <span className="text-gold-hi">●</span> perto de você ·{" "}
                <span className="text-[#5a5a64]">●</span> longe
              </p>

              {/* aqui são três, então cabem na linha do celular — mas a grade
                  mantém as colunas alinhadas em vez de dependerem do tamanho
                  da palavra embaixo de cada número */}
              <dl className="mt-5 grid grid-cols-3 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8">
                <Stat valor={String(pautas.length)} rotulo="missões" />
                <Stat valor={String(naFila)} rotulo="na fila" />
                <Stat valor={String(emAndamento)} rotulo="em produção" />
              </dl>
            </div>
          </section>

          <section className="reveal mt-6 rounded-2xl border border-line bg-surface/60 p-5 lg:p-6" style={{ animationDelay: "0.05s" }}>
            <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-gold">
              Missões de {cand.nome}
            </h2>
            {pautas.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma missão ainda.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pautas.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface/40 p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                        {p.titulo}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-2">
                        {ROTULO_FORMATO[p.formato]}
                      </p>
                    </div>
                    <span className="rounded-full border border-line bg-ink-2 px-3 py-1 text-xs text-muted">
                      {ROTULO_STATUS[p.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
