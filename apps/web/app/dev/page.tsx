import { isDevAuthBypassEnabled } from "@oficina/config/dev-mode";
import Link from "next/link";
import { notFound } from "next/navigation";

export default function DevToolbarPage() {
  // Página estática com links de "entrar como inspetor". A rota de dev-login já
  // recusa fora do desenvolvimento, mas a página em si ficava pública e
  // indexável — some junto com o portão.
  if (!isDevAuthBypassEnabled()) notFound();

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-16">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
        Developer & Testing Hub
      </h1>
      <p className="mt-2 text-sm text-muted">
        Quick authentication shortcuts for local development and UI testing.
      </p>

      <div className="mt-8 flex flex-col gap-3">
        <a href="/api/auth/dev-login?role=editor" className="btn-gold text-center py-3">
          Sign In as Video Editor
        </a>
        <a href="/api/auth/dev-login?role=spokesperson" className="btn-ghost text-center py-3">
          Sign In as Spokesperson
        </a>
        <a href="/api/auth/dev-login?role=admin" className="btn-ghost text-center py-3">
          Sign In as Inspector
        </a>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <Link href="/" className="text-xs text-gold-hi hover:underline">
          ← Back to Homepage
        </Link>
      </div>
    </div>
  );
}
