import Link from "next/link";
import { Logo } from "@/components/logo";

// Cai aqui quando um `notFound()` dispara (ex.: missão que não é sua, ou id
// inexistente) e em qualquer URL que não casa com rota. Antes era o 404 cru
// do Next: sem marca e, pior, sem link nenhum de volta.
export default function NaoEncontrado() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto w-16 opacity-60" />

        <p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-semibold text-gold-lo">
          404
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
          Essa página não existe
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          O link pode estar velho — ou é uma missão que não é sua.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-gold grid place-items-center sm:w-44">
            Ir pro início
          </Link>
          <Link href="/login" className="btn-ghost grid place-items-center sm:w-44">
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
