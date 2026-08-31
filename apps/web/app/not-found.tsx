import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-5 py-16">
      <div className="w-full max-w-md text-center">
        {/* Emblema sozinho: o componente Logo é uma linha com o nome do lado, e
            numa largura curta o nome era espremido até sumir. */}
        <Image
          src="/emblema.png"
          alt=""
          aria-hidden="true"
          width={365}
          height={365}
          className="mx-auto h-14 w-14 select-none opacity-60"
        />

        <p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-semibold text-gold-lo">
          404
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
          Página não encontrada
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          O link pode estar desatualizado, ou essa missão não existe mais.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-gold sm:w-44">
            Ir para o início
          </Link>
          <Link href="/login" className="btn-ghost sm:w-44">
            Entrar
          </Link>
        </div>
      </div>
    </main>
  );
}
