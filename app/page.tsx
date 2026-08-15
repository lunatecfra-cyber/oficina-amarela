import Link from "next/link";
import Image from "next/image";
import { NOVIDADES, dataCurta } from "@/lib/novidades";
import { AoAparecer } from "@/components/ao-aparecer";
import { BrilhoDoMouse } from "@/components/brilho-do-mouse";
import { novidadesPublicadas } from "@/lib/novidades-db";

// Esta página é pública e é a mais visitada — consultar o banco a cada visita
// gastaria cota do Neon à toa. Cinco minutos de cache: novidade não é notícia
// de última hora, e quem publica vê o resultado no painel na hora.
export const revalidate = 300;

// Esta é a porta de entrada: quem chega aqui ainda não tem conta e não sabe o
// que é a Oficina Amarela. Antes a página só perguntava "o que você é?" e
// mandava pro cadastro — quem nunca tinha ouvido falar não tinha como decidir,
// porque nada explicava o que acontece depois de entrar.
//
// A ordem responde, nesta sequência, as perguntas de quem acabou de chegar:
// o que é isso, como funciona, serve pra mim, tem gente mexendo nisso, e como
// eu entro.

// Duas trilhas que correm em paralelo e se encontram no fim. Antes eram três
// passos em fila, e a fila escondia o principal: são duas pessoas diferentes
// fazendo coisas diferentes ao mesmo tempo. Quem chega quer saber o que ELE vai
// fazer, não o processo inteiro em ordem cronológica.
const TRILHAS = [
  {
    lado: "Do lado de quem pede",
    quem: "Candidato",
    passos: [
      { t: "Grava no celular", d: "Sem estúdio, sem equipe. O celular resolve." },
      { t: "Joga no Google Drive", d: "O vídeo fica no seu Drive. Nunca sai de lá." },
      { t: "Abre a missão", d: "Diz o tom, a cor, o formato — e manda pra guilda." },
      { t: "Recebe pronto", d: "Assiste, aprova e posta. Ou pede um ajuste." },
    ],
  },
  {
    lado: "Do lado de quem edita",
    quem: "Editor",
    passos: [
      { t: "Faz as aulas", d: "Aprende o que a Oficina espera de uma entrega." },
      { t: "Entra na fila", d: "Fica disponível e espera. Sem disputar com ninguém." },
      { t: "Aceita a missão", d: "Ela chega até você, uma por vez. Aceita ou passa." },
      { t: "Entrega e sobe", d: "Cada aprovação vira nota, reputação e nível." },
    ],
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

export default async function Home() {
  // O que o inspetor escreveu manda. O texto do arquivo é só o que a página
  // mostra enquanto ninguém publicou nada — melhor do que uma seção vazia numa
  // porta de entrada. Publicou a primeira, o arquivo sai de cena.
  const doBanco = await novidadesPublicadas(4).catch(() => []);
  const novidades =
    doBanco.length > 0
      ? doBanco.map((n) => ({
          data: n.criadaEm.slice(0, 10),
          titulo: n.titulo,
          texto: n.texto,
        }))
      : NOVIDADES.slice(0, 4);

  return (
    <main className="flex-1">
      {/* ---- abertura ----
          O peso está em três coisas, nesta ordem: o nome, uma frase que diz o
          que é, e um caminho só pra seguir. A onça vem depois, grande e
          cortada na base — ela não é enfeite no canto, é a última coisa que a
          pessoa vê antes de rolar, e o que faz a marca ficar. */}
      <section className="relative overflow-hidden px-6 pt-12 lg:pt-16">
        {/* clarão dourado atrás do texto: dá profundidade ao preto sem clarear
            o fundo, que é travado na identidade */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[70%]"
          style={{
            background:
              "radial-gradient(70% 55% at 50% 12%, rgba(244,206,31,0.13), transparent 68%)",
          }}
        />

        {/* halo que acompanha o mouse. Só onde existe mouse — em celular o
            componente nem se monta. */}
        <BrilhoDoMouse />

        <div className="relative mx-auto w-full max-w-5xl">
          <span className="entra-selo mx-auto flex w-fit items-center gap-2 rounded-full border border-gold-lo/40 bg-gold/[0.07] px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-gold-hi">
            <span aria-hidden="true" className="text-gold">
              ✦
            </span>
            Do vídeo bruto ao vídeo pronto
          </span>

          {/* A onça ao lado do nome, não embaixo dele. Assim a marca inteira —
              símbolo mais palavra — é a primeira coisa que se lê, num bloco só.
              No celular empilha: lado a lado sobraria letra pequena demais. */}
          <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:justify-center sm:gap-8 lg:gap-10">
            {/* `reveal` e `respira` NÃO podem ficar no mesmo elemento: as duas
                declaram `animation`, que é propriedade única — a segunda apaga
                a primeira. Como `reveal` começa em `opacity: 0` e é a animação
                dela que traz de volta, juntar as duas deixava a onça invisível.
                Por isso o respiro fica no bloco de fora e a revelação na
                imagem. */}
            {/* Três animações, três elementos — nunca duas no mesmo, porque
                `animation` é propriedade única e a segunda apaga a primeira.
                De fora pra dentro: profundidade ao rolar, respiro contínuo,
                entrada. */}
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

            <h1 className="text-gold-grad titulo-lustro text-center font-[family-name:var(--font-display)] text-5xl font-semibold leading-[0.92] tracking-[0.1em] sm:text-left sm:text-6xl lg:text-7xl">
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
            A guilda de quem edita. Candidatos mandam o bruto, editores recebem
            missões e entregam.
          </p>

          <div
            className="reveal mx-auto mt-8 flex w-full max-w-xs flex-col items-center gap-3"
            style={{ "--reveal-delay": "740ms" } as React.CSSProperties}
          >
            <Link href="/criar-conta" className="btn-gold btn-brilho w-full overflow-hidden">
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

        {/* fecho da seção: um fio dourado que some nas pontas, em vez de a
            abertura terminar no vazio */}
        <div
          aria-hidden="true"
          className="divider-glint mx-auto mt-16 h-px w-full max-w-md bg-gradient-to-r from-transparent via-gold-lo/60 to-transparent lg:mt-20"
        />
      </section>

      {/* ---- como funciona: duas trilhas ---- */}
      <section className="px-6 py-16 lg:py-24">
        <div className="mx-auto w-full max-w-5xl">
          <h2 className="text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
            Como funciona
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-sm text-muted">
            São dois caminhos correndo ao mesmo tempo. Eles se encontram no
            vídeo pronto.
          </p>

          <div className="relative mt-12 grid gap-8 md:grid-cols-2 md:gap-10">
            {/* fio vertical entre as duas colunas: mostra que correm em
                paralelo, sem precisar dizer. Só no PC — no celular as trilhas
                ficam uma embaixo da outra e o fio mentiria. */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-line to-transparent md:block"
            />

            {TRILHAS.map((trilha, iT) => (
              <AoAparecer key={trilha.quem} atraso={iT * 140}>
                <div className="mb-6 text-center md:text-left">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-2">
                    {trilha.lado}
                  </p>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold text-gold-hi">
                    {trilha.quem}
                  </p>
                </div>

                <ol className="relative flex flex-col gap-5 pl-9">
                  {/* fio que costura os passos da trilha */}
                  <span
                    aria-hidden="true"
                    className="absolute bottom-4 left-[11px] top-3 w-px bg-gradient-to-b from-gold-lo/50 via-line to-transparent"
                  />

                  {trilha.passos.map((p, i) => (
                    <li key={p.t} className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -left-9 top-1 grid h-6 w-6 place-items-center rounded-full border border-gold-lo/50 bg-ink-2 font-[family-name:var(--font-display)] text-[11px] font-semibold text-gold-hi"
                      >
                        {i + 1}
                      </span>
                      <h3 className="font-medium text-text">{p.t}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">{p.d}</p>
                    </li>
                  ))}
                </ol>
              </AoAparecer>
            ))}
          </div>

          {/* o ponto onde as duas trilhas se encontram */}
          <div className="mt-12 flex flex-col items-center">
            <span
              aria-hidden="true"
              className="h-8 w-px bg-gradient-to-b from-transparent to-gold-lo/60"
            />
            <p className="mt-4 rounded-full border border-gold-lo/50 bg-gold/[0.07] px-5 py-2 text-sm font-medium text-gold-hi">
              O vídeo volta pronto
            </p>
          </div>

          {/* A promessa que mais importa e que ninguém pergunta em voz alta:
              onde fica o vídeo. Vale dizer antes de pedir cadastro. */}
          <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-relaxed text-muted-2">
            O vídeo fica no Google Drive de quem gravou, do começo ao fim. A
            Oficina Amarela não guarda arquivo de ninguém.
          </p>
        </div>
      </section>

      {/* ---- para quem ---- */}
      <section className="border-t border-line-soft px-6 py-16 lg:py-24">
        <div className="mx-auto w-full max-w-4xl">
          <h2 className="text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
            O que você é?
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-center text-sm text-muted">
            Escolhe de onde você entra. Dá pra mudar depois.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {PARA_QUEM.map((q, i) => (
              <AoAparecer key={q.titulo} atraso={i * 120} className="flex">
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

                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-gold-hi transition-colors group-hover:text-gold">
                  Começar por aqui
                  {/* a seta anda um passo quando o mouse chega: dá a sensação
                      de que o card leva pra algum lugar */}
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-300 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </span>
              </Link>
              </AoAparecer>
            ))}
          </div>
        </div>
      </section>

      {/* ---- novidades ---- */}
      <section className="border-t border-line-soft px-6 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
            Atualizações
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-muted">
            A Oficina é mexida quase todo dia. Isso é o mais recente.
          </p>

          <ul className="mt-10 flex flex-col gap-3">
            {novidades.map((n, i) => (
              <AoAparecer key={n.titulo} atraso={i * 90}>
                <li className="group flex flex-col gap-1 rounded-2xl border border-line bg-surface/60 p-5 transition-colors duration-300 hover:border-gold-lo/40 sm:flex-row sm:gap-5">
                  <span className="flex-none text-xs uppercase tracking-[0.12em] text-gold-lo sm:w-16 sm:pt-0.5">
                    {dataCurta(n.data)}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-text">
                      {n.titulo}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{n.texto}</p>
                  </div>
                </li>
              </AoAparecer>
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
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
            Entrar para a Oficina
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

          {/* inline-block com py: sem isso o link tinha 15px de altura e virava
              uma linha fina que o dedo erra. O padding não muda o desenho —
              só aumenta a área que responde ao toque. */}
          <p className="mt-6 text-xs text-muted-2">
            <Link href="/termos" className="inline-block py-2 hover:text-muted">
              Termos de uso
            </Link>
            <span className="px-1">·</span>
            <Link href="/privacidade" className="inline-block py-2 hover:text-muted">
              Política de privacidade
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
