import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = { title: "Redefinir senha — Oficina Amarela" };

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-14">
      <Link href="/" className="mb-8 flex flex-col items-center text-center">
        <Logo size="large" showName={false} />
        <p className="text-gold-grad mt-4 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[0.2em]">
          OFICINA AMARELA
        </p>
      </Link>

      <h1 className="mb-7 font-[family-name:var(--font-display)] text-2xl font-semibold text-text">
        Escolher nova senha
      </h1>

      <ResetPasswordForm />
    </main>
  );
}
