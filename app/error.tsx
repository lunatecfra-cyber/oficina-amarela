"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
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
          Alguma coisa quebrou aqui
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          Foi um erro inesperado da nossa parte. Tente de novo — se continuar, mande esse código pro suporte.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted-2">
            Código do erro: {error.digest}
          </p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={unstable_retry} className="btn-gold sm:w-44">
            Tentar de novo
          </button>
          <Link href="/" className="btn-ghost sm:w-44">
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
