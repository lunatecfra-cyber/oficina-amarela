import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { NavInspetor } from "@/components/nav-inspetor";
import { GuiaDoLocal } from "@/components/guia-do-local";
import { exigirSessao } from "@/lib/sessao-servidor";

export default async function InspetorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await exigirSessao();

  if (sessao.papel !== "admin") {
    redirect("/login");
  }

  return (
    <>
      <header className="border-b border-line-soft">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/inspetor" className="flex items-center gap-3">
            <Logo className="w-9" />
            {/* mesmo motivo do cabeçalho do candidato: com o "Como usar" na
                linha, os dois juntos passavam de 390px */}
            <span className="hidden font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold sm:inline">
              OFICINA AMARELA
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            <GuiaDoLocal />

            <span className="hidden text-sm text-muted sm:block">
              {sessao.nome} · controle de qualidade
            </span>
            <Link
              href="/"
              className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-silver-hi"
            >
              Sair
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-5xl px-5 lg:px-8">
          <NavInspetor />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
