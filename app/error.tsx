"use client"; // error boundary tem que ser Client Component

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

// Rede de segurança do app inteiro. Antes disto, qualquer falha de servidor
// (banco fora do ar, por exemplo) deixava a TELA BRANCA: sem mensagem, sem
// botão, sem caminho de volta.
//
// Next 16: a prop de recarregar chama `unstable_retry` — em versões anteriores
// era `reset`.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // erro que estourou no cliente não passa pelo onRequestError do
    // servidor — este é o único lugar que o captura
    Sentry.captureException(error, { tags: { digest: error.digest } });
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-danger/40 bg-danger/[0.07] text-2xl">
          ⚠️
        </span>

        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
          Algo quebrou aqui
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Não foi culpa sua. Tente de novo — se insistir, avise a gente.
        </p>

        {/* o digest é o que liga esta tela ao log do servidor. Em produção a
            mensagem real não vem pro cliente, só este identificador. */}
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted-2">
            código: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={unstable_retry} className="btn-gold sm:w-44">
            Tentar de novo
          </button>
          <Link href="/" className="btn-ghost grid place-items-center sm:w-44">
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
