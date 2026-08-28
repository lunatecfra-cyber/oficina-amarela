import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto w-16 opacity-60" />

        <p className="mt-6 font-[family-name:var(--font-display)] text-5xl font-semibold text-gold-lo">
          404
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
          Page Not Found
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          The link may be outdated, or this mission does not exist.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-gold grid place-items-center sm:w-44">
            Home
          </Link>
          <Link href="/login" className="btn-ghost grid place-items-center sm:w-44">
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}
