import Link from "next/link";
import { Logo } from "@/components/logo";
import { BotaoSair } from "@/components/botao-sair";
import { GuiaDoLocal } from "@/components/guia-do-local";
import { lerSessao } from "@/lib/sessao-servidor";

export async function AppHeaderPortaVoz() {
  const sessao = await lerSessao();
  
  if (!sessao) return null;

  return (
    <header className="border-b border-line-soft">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
        <Link href="/porta-voz" className="flex items-center gap-3">
          <Logo className="w-9" />
          <span className="hidden font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold sm:inline">
            OFICINA AMARELA
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <GuiaDoLocal />

          <Link
            href="/porta-voz/perfil"
            className="text-sm text-muted transition-colors hover:text-text"
          >
            <span className="hidden sm:inline">
              {sessao.nome} · {sessao.papel === "admin" ? "inspetor" : "porta-voz"}
            </span>
            <span className="sm:hidden">Perfil</span>
          </Link>

          <Link
            href="/parceiros"
            className="text-sm text-muted transition-colors hover:text-text"
          >
            Parceiros
          </Link>

          {sessao.papel === "admin" && (
            <Link
              href="/inspetor"
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-gold-lo/60 hover:text-gold-hi"
            >
              Inspetor
            </Link>
          )}

          <BotaoSair className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-silver-hi" />
        </div>
      </div>
    </header>
  );
}
