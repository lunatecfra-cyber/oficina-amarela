"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

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
          Something went wrong
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          An unexpected error occurred. Please try again or contact support if the issue persists.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted-2">Error ID: {error.digest}</p>
        )}

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button onClick={unstable_retry} className="btn-gold sm:w-44">
            Try Again
          </button>
          <Link href="/" className="btn-ghost grid place-items-center sm:w-44">
            Back to Home
          </Link>
        </div>
      </div>
    </main>
  );
}
