import Link from "next/link";
import Image from "next/image";
import { NOVIDADES, shortDate } from "@/lib/news";
import { OnAppear } from "@/components/on-appear";
import { MouseGlow } from "@/components/mouse-glow";
import { NextStep } from "@/components/next-step";
import { FestivalAwards } from "@/components/festival-awards";
import { publishedNews } from "@/lib/news-db";

export const revalidate = 300;

const TRACKS = [
  {
    side: "Do lado de quem pede",
    role: "Porta-voz",
    steps: [
      { t: "Grava no celular", d: "Sem estúdio, sem equipe. O celular resolve." },
      { t: "Joga no Google Drive", d: "O vídeo fica no seu Drive. Nunca sai de lá." },
      { t: "Abre a missão", d: "Diz o tom, a cor, o formato — e manda pra guilda." },
      { t: "Recebe pronto", d: "Assiste, aprova e posta. Ou pede um ajuste." },
    ],
  },
  {
    side: "Do lado de quem edita",
    role: "Editor",
    steps: [
      { t: "Faz as aulas", d: "Aprende o que a Oficina espera de uma entrega." },
      { t: "Entra na fila", d: "Fica disponível e espera. Sem disputar com ninguém." },
      { t: "Aceita a missão", d: "Ela chega até você, uma por vez. Aceita ou passa." },
      { t: "Entrega e sobe", d: "Cada aprovação vira nota, reputação e nível." },
    ],
  },
];

const TARGET_AUDIENCE = [
  {
    href: "/criar-conta?papel=voz",
    title: "Sou porta-voz",
    desc: "Você tem o vídeo bruto e precisa que alguém edite. Abre a missão e acompanha até o vídeo voltar pronto.",
    items: ["Grava e manda o link do Drive", "Diz o tom, a cor e o formato", "Assiste, aprova ou pede ajuste"],
    icon: (
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3ZM5 10v1a7 7 0 0 0 14 0v-1M12 19v3" />
    ),
  },
  {
    href: "/criar-conta?papel=editor",
    title: "Sou editor",
    desc: "As missões chegam até você. Aceita, edita, entrega — e sobe de nível a cada trabalho aprovado.",
    items: ["Recebe missão sem disputar", "Uma por vez, sem acúmulo", "Nota e reputação a cada entrega"],
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m10 8 6 4-6 4V8Z" />
      </>
    ),
  },
];

export default async function Home() {
  const fromDb = await publishedNews(4).catch(() => []);
  const news =
    fromDb.length > 0
      ? fromDb.map((n) => ({
          date: n.createdAt.slice(0, 10),
          title: n.title,
          text: n.text,
        }))
      : NOVIDADES.slice(0, 4).map((n) => ({
          date: n.data,
          title: n.titulo,
          text: n.texto,
        }));

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden px-6 pt-12 lg:pt-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[70%]"
          style={{
            background:
              "radial-gradient(70% 55% at 50% 12%, rgba(244,206,31,0.13), transparent 68%)",
          }}
        />

        <MouseGlow />

        <div className="relative mx-auto w-full max-w-5xl">
          <span className="entra-selo mx-auto flex w-fit items-center gap-2 rounded-full border border-gold-lo/40 bg-gold/[0.07] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-gold-hi">
            <span aria-hidden="true" className="text-gold">
              ✦
            </span>
            Do vídeo bruto ao vídeo pronto
          </span>

          <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8 lg:gap-10">
            <div className="profundidade relative flex-none">
              <div className="respira" style={{ willChange: "transform" }}>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -m-8"
                  style={{
                    background:
                      "radial-gradient(50% 50% at 50% 50%, rgba(244,206,31,0.20), transparent 70%)",
                  }}
                />
                <Image
                  src="/emblema.png"
                  alt=""
                  aria-hidden="true"
                  width={365}
                  height={365}
                  priority
                  className="entra-marca relative w-36 select-none sm:w-44 lg:w-60"
                />
              </div>
            </div>

            <h1 className="text-gold-grad text-center font-[family-name:var(--font-display)] text-5xl font-semibold leading-[0.92] tracking-[0.1em] sm:text-left sm:text-6xl lg:text-7xl">
              <span className="entra-linha" style={{ "--linha-atraso": "340ms" } as React.CSSProperties}>
                OFICINA
              </span>
              <span className="entra-linha" style={{ "--linha-atraso": "460ms" } as React.CSSProperties}>
                AMARELA
              </span>
            </h1>
          </div>

          <p
            className="reveal mx-auto mt-7 max-w-md text-center text-base leading-relaxed text-muted lg:text-lg"
            style={{ "--reveal-delay": "620ms" } as React.CSSProperties}
          >
            A guilda de quem edita. Porta-vozes mandam o bruto, editores recebem
            uma missão por vez e todo mundo evolui junto.
          </p>

          <div
            className="reveal mx-auto mt-8 flex w-full max-w-xs flex-col items-center gap-3"
            style={{ "--reveal-delay": "740ms" } as React.CSSProperties}
          >
            <Link href="/criar-conta" className="btn-gold btn-brilho w-full overflow-hidden text-center text-lg flex items-center justify-center">
              Criar minha conta
            </Link>
            <Link
              href="/login"
              className="inline-block px-3 py-2 text-sm text-muted transition-colors hover:text-gold-hi"
            >
              Já sou membro
            </Link>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="divider-glint mx-auto mt-16 h-px w-full max-w-md bg-gradient-to-r from-transparent via-gold-lo/60 to-transparent lg:mt-20"
        />
      </section>

      <FestivalAwards />
      <NextStep />

      <section id="como-funciona" className="relative overflow-hidden px-6 py-16 lg:py-24">
        <div className="mx-auto w-full max-w-5xl">
          <div className="max-w-2xl">
            <h2 className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-none text-text lg:text-6xl">
              Do bruto ao pronto
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted lg:text-base">
              Duas pessoas, dois ritmos e um mesmo vídeo. A produção começa no
              celular e termina com uma entrega que dá gosto de publicar.
            </p>
          </div>

          <div className="relative mt-14 grid gap-10 md:grid-cols-2 md:gap-16">
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-gold-lo/70 via-line to-transparent md:block"
            />

            {TRACKS.map((track, iT) => (
              <OnAppear key={track.role} delay={iT * 140}>
                <div className="mb-6 text-center md:text-left">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-2">
                    {track.side}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-gold-hi">
                    {track.role}
                  </p>
                </div>

                <ol className="relative flex flex-col gap-5 pl-9">
                  <span
                    aria-hidden="true"
                    className="absolute bottom-4 left-[11px] top-3 w-px bg-gradient-to-b from-gold-lo/50 via-line to-transparent"
                  />

                  {track.steps.map((p, i) => (
                    <li key={p.t} className="group relative">
                      <span
                        aria-hidden="true"
                        className="absolute -left-9 top-1 grid h-6 w-6 place-items-center rounded-full border border-gold-lo/50 bg-ink-2 font-[family-name:var(--font-display)] text-[11px] font-semibold text-gold-hi"
                      >
                        {i + 1}
                      </span>
                      <h3 className="font-medium text-text transition-colors group-hover:text-gold-hi">{p.t}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">{p.d}</p>
                    </li>
                  ))}
                </ol>
              </OnAppear>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center">
            <span
              aria-hidden="true"
              className="h-8 w-px bg-gradient-to-b from-transparent to-gold-lo/60"
            />
            <p className="mt-4 rounded-full border border-gold-lo/50 bg-gold/[0.07] px-5 py-2 text-sm font-medium text-gold-hi">
              O vídeo volta pronto
            </p>
          </div>

          <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-relaxed text-muted-2">
            O vídeo fica no Google Drive de quem gravou, do começo ao fim. A
            Oficina Amarela não guarda arquivo de ninguém.
          </p>
        </div>
      </section>

      <section className="border-t border-line-soft px-6 py-16 lg:py-24">
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
            O que você é?
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-muted">
            Escolhe de onde você entra. Dá pra mudar depois.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {TARGET_AUDIENCE.map((q, i) => (
              <OnAppear key={q.title} delay={i * 120} className="flex">
                <Link
                  href={q.href}
                  className="role-card group flex flex-1 flex-col rounded-2xl border border-line bg-surface/70 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gold/60 hover:bg-surface-2 hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)] lg:p-8"
                >
                  <span className="inline-grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-2 text-silver transition-colors group-hover:border-gold/50 group-hover:text-gold">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      {q.icon}
                    </svg>
                  </span>

                  <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-text lg:text-2xl">
                    {q.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{q.desc}</p>

                  <ul className="mt-4 flex flex-col gap-1.5">
                    {q.items.map((it) => (
                      <li key={it} className="flex items-baseline gap-2 text-xs text-muted-2">
                        <span aria-hidden="true" className="text-gold-lo">
                          ✓
                        </span>
                        {it}
                      </li>
                    ))}
                  </ul>

                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-gold-hi transition-colors group-hover:text-gold">
                    Começar por aqui
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-300 group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </span>
                </Link>
              </OnAppear>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line-soft px-6 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
            Atualizações
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
            A Oficina é mexida quase todo dia. Isso é o mais recente.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
            {news.map((n, i) => (
              <OnAppear key={n.title} delay={i * 90}>
                <li className="group flex flex-col gap-1 rounded-2xl border border-line bg-surface/60 p-5 transition-colors duration-300 hover:border-gold-lo/40 sm:flex-row sm:gap-5">
                  <span className="flex-none text-xs uppercase tracking-[0.12em] text-gold-lo sm:w-16 sm:pt-0.5">
                    {shortDate(n.date ?? (n as any).data ?? "")}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                      {n.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{n.text}</p>
                  </div>
                </li>
              </OnAppear>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative overflow-hidden border-t border-line-soft px-6 py-16 lg:py-20">
        <Image
          src="/emblema.png"
          alt=""
          aria-hidden="true"
          width={365}
          height={365}
          className="pointer-events-none absolute -right-10 top-1/2 w-48 -translate-y-1/2 opacity-[0.06] lg:w-64"
        />
        <div className="relative mx-auto w-full max-w-2xl text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
            Entrar para a Oficina
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Criar conta leva menos de um minuto. Dá pra entrar com o Google ou
            com apelido e senha.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/criar-conta" className="btn-gold sm:w-52 text-center flex items-center justify-center">
              Criar minha conta
            </Link>
            <Link href="/login" className="btn-ghost sm:w-40 text-center flex items-center justify-center">
              Fazer login
            </Link>
          </div>

          <p className="mt-6 text-xs text-muted-2">
            <Link href="/termos" className="inline-block py-2 hover:text-muted">
              Termos de uso
            </Link>
            <span className="px-1">·</span>
            <Link href="/privacidade" className="inline-block py-2 hover:text-muted">
              Política de privacidade
            </Link>
            <span className="px-1">·</span>
            <Link href="/parceiros" className="inline-block py-2 hover:text-muted">
              Parceiros
            </Link>
          </p>
        </div>
      </section>

      <section className="border-t border-line-soft px-6 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
            Parceiros
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
            Comunidades parceiras pra você se conectar.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
            <li>
              <a
                href="https://discord.gg/NA3BJAsYfK"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[#5865F2]/30 bg-gradient-to-r from-[#5865F2]/[0.08] via-surface/60 to-surface/40 p-5 transition-all duration-300 hover:border-[#5865F2]/70 hover:shadow-[0_0_32px_rgba(88,101,242,0.18)]"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#5865F2]/10 blur-xl transition-all duration-500 group-hover:bg-[#5865F2]/20" />
                <span className="inline-grid h-12 w-12 flex-none place-items-center rounded-xl border border-[#5865F2]/40 bg-[#5865F2]/15 text-[#5865F2] transition-all duration-300 group-hover:scale-105 group-hover:bg-[#5865F2]/25 group-hover:text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
                    <path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.9 19.9 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text sm:text-lg">
                      Discord
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#5865F2]/40 bg-[#5865F2]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5865F2]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#5865F2]" />
                      Ativo
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    Servidor pra conversar, tirar dúvidas e acompanhar o que tá rolando.
                  </p>
                </div>

                <span className="flex-none text-xs font-semibold uppercase tracking-wide text-[#5865F2] transition-transform duration-300 group-hover:translate-x-1">
                  Entrar →
                </span>
              </a>
            </li>
            <li>
              <a
                href="https://chat.whatsapp.com/IvBufb6H1a52HoVV4uxXmR"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[#25D366]/30 bg-gradient-to-r from-[#25D366]/[0.08] via-surface/60 to-surface/40 p-5 transition-all duration-300 hover:border-[#25D366]/70 hover:shadow-[0_0_32px_rgba(37,211,102,0.18)]"
              >
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#25D366]/10 blur-xl transition-all duration-500 group-hover:bg-[#25D366]/20" />
                <span className="inline-grid h-12 w-12 flex-none place-items-center rounded-xl border border-[#25D366]/40 bg-[#25D366]/15 text-[#25D366] transition-all duration-300 group-hover:scale-105 group-hover:bg-[#25D366]/25 group-hover:text-white">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z" />
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text sm:text-lg">
                      WhatsApp da Guilda
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#25D366]/40 bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#25D366]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#25D366]" />
                      Ativo
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    Grupo pra trocar ideia, pedir ajuda e ficar por dentro das novidades.
                  </p>
                </div>

                <span className="flex-none text-xs font-semibold uppercase tracking-wide text-[#25D366] transition-transform duration-300 group-hover:translate-x-1">
                  Entrar →
                </span>
              </a>
            </li>
          </ul>
        </div>
      </section>
    </main>
  );
}
