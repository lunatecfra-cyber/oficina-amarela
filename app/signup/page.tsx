import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = { title: "Criar conta — Oficina Amarela" };

export default function SignupPage() {
  const isDev = process.env.NODE_ENV === "development" && !process.env.VERCEL;

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-14">
      <Link href="/" className="mb-6 flex flex-col items-center text-center">
        <Logo size="large" />
        <p className="text-gold-grad mt-3 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[0.2em]">
          OFICINA AMARELA
        </p>
      </Link>

      <div className="mb-6 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-lg font-semibold text-silver-hi">
          Criar sua conta
        </h1>
        <p className="mt-1 text-sm text-muted">
          Escolha como quer participar — <span className="text-silver">porta-voz</span> posta
          missões e <span className="text-silver">editor</span> entrega edições.
        </p>
      </div>

      <Suspense>
        <SignupForm devMode={isDev} />
      </Suspense>
    </main>
  );
}
