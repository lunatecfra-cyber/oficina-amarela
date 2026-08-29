import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { RecoverForm } from "@/components/recover-form";

export const metadata: Metadata = { title: "Recuperar senha — Oficina Amarela" };

export default function RecoverPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-14">
      <Link href="/" className="mb-8 flex flex-col items-center text-center">
        <Logo size="large" />
        <p className="text-gold-grad mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[0.2em]">
          OFICINA AMARELA
        </p>
      </Link>

      <h1 className="mb-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
        Recuperar senha
      </h1>
      <p className="mb-7 max-w-sm text-center text-sm text-muted">
        Se a sua conta usa um e-mail do Google, o caminho mais rápido é entrar
        direto por ele — o Google confirma que o e-mail é seu e você entra na
        mesma conta de sempre.
      </p>

      <a
        href="/api/auth/google"
        className="btn-gold mb-6 flex w-full max-w-sm items-center justify-center gap-3"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6v-3.1h-4a12 12 0 0 0 0 10.8l4-3.1z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z" />
        </svg>
        Entrar com o Google
      </a>

      <div className="mb-6 flex w-full max-w-sm items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-[11px] uppercase tracking-[0.14em] text-muted-2">
          ou pelo e-mail
        </span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <RecoverForm />
    </main>
  );
}
