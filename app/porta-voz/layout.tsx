import Link from "next/link";
import { Logo } from "@/components/logo";
import { BotaoSair } from "@/components/botao-sair";
import { exigirSessao } from "@/lib/sessao-servidor";

export default async function PortaVozLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // cobre todas as telas de /porta-voz/* — derruba sessão revogada
  const sessao = await exigirSessao();

  return (
    <>
      <header className="border-b border-line-soft">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/porta-voz" className="flex items-center gap-3">
            <Logo className="w-9" />
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold">
              OFICINA AMARELA
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {/* no mobile só o "Perfil" cabe, mas ele PRECISA aparecer: este é
                o único caminho pro perfil e, por tabela, pro criar-perfil.
                Escondido no celular, o porta-voz ficava sem como se editar. */}
            <Link
              href="/porta-voz/perfil"
              className="text-sm text-muted transition-colors hover:text-text"
            >
              <span className="hidden sm:inline">{sessao.nome} · porta-voz</span>
              <span className="sm:hidden">Perfil</span>
            </Link>
            <BotaoSair className="text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-silver-hi" />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </>
  );
}
