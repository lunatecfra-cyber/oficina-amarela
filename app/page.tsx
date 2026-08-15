import Link from "next/link";
import Image from "next/image";
import { Logo } from "@/components/logo";
import { NOVIDADES, dataCurta } from "@/lib/novidades";

// Esta é a porta de entrada: quem chega aqui ainda não tem conta e não sabe o
// que é a Oficina Amarela. Antes a página só perguntava "o que você é?" e
// mandava pro cadastro — quem nunca tinha ouvido falar não tinha como decidir,
// porque nada explicava o que acontece depois de entrar.
//
// A ordem responde, nesta sequência, as perguntas de quem acabou de chegar:
// o que é isso, como funciona, serve pra mim, tem gente mexendo nisso, e como
// eu entro.

const PASSOS = [
  {
    n: "01",
    titulo: "O candidato manda o bruto",
    desc: "Grava no celular, joga no Google Drive e abre uma missão dizendo o que quer. O vídeo nunca sai do Drive dele.",
  },
  {
    n: "02",
    titulo: "A missão chega a um editor",
    desc: "Não é lista pra disputar: a Oficina oferece a missão a um editor por vez. Ele aceita ou passa adiante.",
  },
  {
    n: "03",
    titulo: "O vídeo volta pronto",
    desc: "O editor entrega, o candidato assiste e libera. Cada entrega aprovada sobe a reputação de quem editou.",
  },
];

const PARA_QUEM = [
  {
    href: "/criar-conta?papel=voz",
    titulo: "Sou candidato",
    desc: "Você tem o vídeo bruto e precisa que alguém edite. Abre a missão e acompanha até o vídeo voltar pronto.",
    itens: ["Grava e manda o link do Drive", "Diz o tom, a cor e o formato", "Assiste, aprova ou pede ajuste"],
    icone: (
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3ZM5 10v1a7 7 0 0 0 14 0v-1M12 19v3" />
    ),
  },
  {
    href: "/criar-conta?papel=editor",
    titulo: "Sou editor",
    desc: "As missões chegam até você. Aceita, edita, entrega — e sobe de nível a cada trabalho aprovado.",
    itens: ["Recebe missão sem disputar", "Uma por vez, sem acúmulo", "Nota e reputação a cada entrega"],
    icone: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m10 8 6 4-6 4V8Z" />
      </>
    ),
  },
];

export default function Home() {
  const novidades = NOVIDADES.slice(0, 4);

  return (
    <main className="flex-1">
      {/* ---- abertura ---- */}
      <section className="relative overflow-hidden px-6 pb-16 pt-16 lg:pb-24 lg:pt-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(90% 60% at 50% 0%, rgba(244,206,31,0.10), transparent 60%)",
          }}
        />
        <div className="relative mx-auto w-full max-w-3xl">
          <div className="flex flex-col items-center text-center">
            <Logo
              className="reveal w-28 lg:w-36"
              style={{ "--reveal-delay": "0ms" } as React.CSSProperties}
            />

            <h1
              className="text-gold-grad reveal mt-7 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-[0.22em] lg:text-6xl"
              style={{ "--reveal-delay": "90ms" } as React.CSSProperties}
            >
              OFICINA AMARELA
            </h1>

            <p
              className="reveal mt-5 max-w-xl text-base leading-relaxed text-muted lg:text-lg"
              style={{ "--reveal-delay": "170ms" } as React.CSSProperties}
            >
              A guilda de quem edita. Candidatos mandam o vídeo bruto, editores
              recebem missões, entregam e sobem de nível.
            </p>

            <div
              className="divider-glint reveal mt-8 h-px w-14 bg-gradient-to-r from-transparent via-gold-lo to-transparent"
              style={{ "--reveal-delay": "260ms" } as React.CSSProperties}
            />

            <div
              className="reveal mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
              style={{ "--reveal-delay": "340ms" } as React.CSSProperties}
            >
              <Link href="/criar-conta" className="btn-gold sm:w-52">
                Criar minha conta
              </Link>
              <Link href="/login" className="btn-ghost sm:w-40 text-center">
                Já sou membro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- como funciona ---- */}
      <section className="border-t border-line-soft px-6 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-center text-xs uppercase tracking-[0.2em] text-gold">
            Como funciona
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
            Três passos, do celular do candidato até o vídeo pronto pra postar.
          </p>

          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li
                key={p.n}
                className="reveal rounded-2xl border border-line bg-surface/60 p-6"
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
              >
                <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.2em] text-gold-lo">
                  {p.n}
                </span>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-lg font-semibold text-text">
                  {p.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.desc}</p>
              </li>
            ))}
          </ol>

          {/* A promessa que mais importa e que ninguém pergunta em voz alta:
              onde fica o vídeo. Vale dizer antes de pedir cadastro. */}
          <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-muted-2">
            O vídeo fica no Google Drive de quem gravou, do começo ao fim. A
            Oficina Amarela não guarda arquivo de ninguém.
          </p>
        </div>
      </section>

      {/* ---- para quem ---- */}
      <section className="border-t border-line-soft px-6 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="text-center text-xs uppercase tracking-[0.2em] text-gold">
            De que lado você está?
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PARA_QUEM.map((q, i) => (
              <Link
                key={q.titulo}
                href={q.href}
                className="role-card reveal group flex flex-col rounded-2xl border border-line bg-surface/70 p-6 transition-colors hover:border-gold/60 hover:bg-surface-2 lg:p-8"
                style={{ "--reveal-delay": `${i * 90}ms` } as React.CSSProperties}
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
                    {q.icone}
                  </svg>
                </span>

                <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-text lg:text-2xl">
                  {q.titulo}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{q.desc}</p>

                <ul className="mt-4 flex flex-col gap-1.5">
                  {q.itens.map((it) => (
                    <li key={it} className="flex items-baseline gap-2 text-xs text-muted-2">
                      <span aria-hidden="true" className="text-gold-lo">
                        ✓
                      </span>
                      {it}
                    </li>
                  ))}
                </ul>

                <span className="mt-5 text-sm font-medium text-gold-hi transition-colors group-hover:text-gold">
                  Começar por aqui →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- novidades ---- */}
      <section className="border-t border-line-soft px-6 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-center text-xs uppercase tracking-[0.2em] text-gold">
            O que mudou por aqui
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
            A Oficina é mexida quase todo dia. Isso é o mais recente.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
            {novidades.map((n, i) => (
              <li
                key={n.titulo}
                className="reveal flex flex-col gap-1 rounded-2xl border border-line bg-surface/60 p-5 sm:flex-row sm:gap-5"
                style={{ "--reveal-delay": `${i * 70}ms` } as React.CSSProperties}
              >
                <span className="flex-none font-[family-name:var(--font-mono,inherit)] text-xs uppercase tracking-[0.12em] text-gold-lo sm:w-16 sm:pt-0.5">
                  {dataCurta(n.data)}
                </span>
                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                    {n.titulo}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{n.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---- fechamento ---- */}
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
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
            Entra pra guilda
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
            Criar conta leva menos de um minuto. Dá pra entrar com o Google ou
            com apelido e senha.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/criar-conta" className="btn-gold sm:w-52">
              Criar minha conta
            </Link>
            <Link href="/login" className="btn-ghost sm:w-40 text-center">
              Fazer login
            </Link>
          </div>

          <p className="mt-8 text-xs text-muted-2">
            <Link href="/termos" className="hover:text-muted">
              Termos de uso
            </Link>
            {" · "}
            <Link href="/privacidade" className="hover:text-muted">
              Política de privacidade
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
