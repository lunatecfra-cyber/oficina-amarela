import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
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
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold">
              OFICINA AMARELA
            </span>
          </Link>

          <div className="flex items-center gap-4">
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
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
