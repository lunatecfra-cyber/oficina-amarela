import Link from "next/link";
import { Logo } from "@/components/logo";

// O papel escolhido aqui já entra pré-selecionado no cadastro. Antes os dois
// cards apontavam pra /entrar, rota que nunca existiu: a landing inteira dava
// 404 e a escolha de papel não levava nada adiante.
const ROLES = [
  {
    href: "/criar-conta?papel=voz",
    title: "Porta-voz",
    desc: "Você tem o vídeo bruto e precisa que alguém edite.",
    icon: (
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3ZM5 10v1a7 7 0 0 0 14 0v-1M12 19v3" />
    ),
  },
  {
    href: "/criar-conta?papel=editor",
    title: "Editor de vídeo",
    desc: "As missões chegam até você. Você aceita, edita e entrega.",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m10 8 6 4-6 4V8Z" />
      </>
    ),
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col items-center text-center">
          <Logo className="reveal w-28 lg:w-36" style={{ "--reveal-delay": "0ms" } as React.CSSProperties} />

          <h1
            className="text-gold-grad reveal mt-7 font-[family-name:var(--font-display)] text-4xl font-semibold tracking-[0.22em] lg:text-6xl"
            style={{ "--reveal-delay": "90ms" } as React.CSSProperties}
          >
            OFICINA AMARELA
          </h1>
          <p
            className="reveal mt-4 text-sm text-muted lg:text-base"
            style={{ "--reveal-delay": "170ms" } as React.CSSProperties}
          >
            A guilda de quem edita. Receba missões, entregue, suba de nível.
          </p>

          <div
            className="divider-glint reveal mt-8 h-px w-14 bg-gradient-to-r from-transparent via-gold-lo to-transparent"
            style={{ "--reveal-delay": "260ms" } as React.CSSProperties}
          />
        </div>

        <p
          className="reveal mt-10 text-center text-xs uppercase tracking-[0.2em] text-muted lg:text-sm"
          style={{ "--reveal-delay": "340ms" } as React.CSSProperties}
        >
          O que você é?
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ROLES.map((role, i) => (
            <Link
              key={role.title}
              href={role.href}
              className="role-card reveal group rounded-2xl border border-line bg-surface/70 p-6 transition-colors hover:border-gold/60 hover:bg-surface-2 lg:p-8"
              style={{ "--reveal-delay": `${420 + i * 80}ms` } as React.CSSProperties}
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
                  {role.icon}
                </svg>
              </span>
              <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold text-text lg:text-2xl">
                {role.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{role.desc}</p>
            </Link>
          ))}
        </div>

        <p
          className="reveal mt-10 text-center text-sm text-muted"
          style={{ "--reveal-delay": "580ms" } as React.CSSProperties}
        >
          Já é membro?{" "}
          <Link href="/login" className="font-medium text-gold-hi hover:underline">
            Faça login
          </Link>
        </p>
      </div>
    </main>
  );
}
