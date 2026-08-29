import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Entrar — Oficina Amarela" };

const PILLARS = [
  {
    text: "As missões chegam até você — aceite a que combinar.",
    icon: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="m10 8 6 4-6 4V8Z" />
      </>
    ),
  },
  {
    text: "Entregue, passe pelo controle de qualidade e ganhe reputação.",
    icon: <path d="M20 6 9 17l-5-5" />,
  },
  {
    text: "Suba de Aprendiz a Mestre-Artesão e desbloqueie os pagos.",
    icon: <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z" />,
  },
];

export default function LoginPage() {
  return (
    <div className="grid flex-1 lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-line-soft p-14 lg:flex">
        <Link href="/" className="relative flex items-center gap-3">
          <Logo size="large" />
          <span className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-[0.3em] text-gold">
            OFICINA AMARELA
          </span>
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-gold-grad font-[family-name:var(--font-display)] text-5xl font-semibold leading-tight">
            A guilda de
            <br />
            quem edita.
          </h2>
          <p className="mt-5 max-w-sm text-[15px] font-light leading-relaxed text-muted">
            Onde o bruto vira arte. Editores entram provando valor, sobem de nível
            e desbloqueiam os trabalhos — em ordem, com mérito.
          </p>
        </div>

        <ul className="relative flex flex-col gap-4">
          {PILLARS.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-sm text-muted">
              <span className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line bg-surface text-gold">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  {p.icon}
                </svg>
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-col items-center justify-center px-6 py-14">
        <h1 className="sr-only">Oficina Amarela — entrar</h1>

        <div className="mb-8 flex flex-col items-center text-center lg:hidden">
          <Logo size="large" />
          <p className="text-gold-grad mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[0.2em]">
            OFICINA AMARELA
          </p>
        </div>

        <p className="mb-7 hidden text-center text-xs uppercase tracking-[0.2em] text-muted lg:block">
          Faça login
        </p>

        <LoginForm />
      </main>
    </div>
  );
}
