import Link from "next/link";
import { Marca } from "@/components/brand-mark";
import { LogoutButton } from "@/components/logout-button";
import { LocalGuide } from "@/components/local-guide";
import { readSession } from "@/lib/server-session";

export async function AppHeaderSpokesperson() {
  const session = await readSession();

  if (!session) return null;

  const isAdmin = session.role === "admin";

  return (
    <header className="border-b border-line-soft">
      {/*
        No celular o cabeçalho é DUAS LINHAS: marca em cima, navegação embaixo.
        Numa linha só não cabia — com o papel de admin aparece um link a mais
        ("Inspetor") e o conjunto transbordava a tela; e para caber, cada link
        acabava com 16 a 26px de altura, longe dos 44 que o dedo acerta.
        A partir de `sm` volta a ser uma linha só.
      */}
      <div className="mx-auto w-full max-w-5xl px-5 lg:px-8">
        <div className="flex items-center justify-between gap-3 py-3 sm:py-4">
          <Link
            href="/porta-voz"
            className="flex min-h-11 flex-none items-center gap-2.5 lg:gap-3"
          >
            <Marca subtitle />
          </Link>

          {/* Na linha de cima ficam só o guia e o sair; o resto desce. */}
          <div className="flex flex-none items-center gap-1 sm:gap-4">
            <LocalGuide />

            <Link
              href="/porta-voz/perfil"
              className="link-toque hidden text-sm text-muted hover:text-text sm:inline-flex"
            >
              {session.name} · {isAdmin ? "inspetor" : "porta-voz"}
            </Link>

            <Link
              href="/parceiros"
              className="link-toque hidden text-sm text-muted hover:text-text sm:inline-flex"
            >
              Parceiros
            </Link>

            {isAdmin && (
              <Link
                href="/inspetor"
                className="link-toque hidden border border-line text-xs font-medium text-muted hover:border-gold-lo/60 hover:text-gold-hi sm:inline-flex"
              >
                Inspetor
              </Link>
            )}

            <LogoutButton className="link-toque text-xs uppercase tracking-[0.12em] text-muted hover:text-silver-hi" />
          </div>
        </div>

        {/* Navegação do celular: alvos inteiros, rolando de lado se precisar. */}
        <nav className="-mx-5 flex items-center gap-1 overflow-x-auto px-5 pb-1 sm:hidden">
          <Link
            href="/porta-voz"
            className="link-toque flex-none whitespace-nowrap text-sm text-muted hover:text-text"
          >
            Missões
          </Link>
          <Link
            href="/porta-voz/perfil"
            className="link-toque flex-none whitespace-nowrap text-sm text-muted hover:text-text"
          >
            Perfil
          </Link>
          <Link
            href="/parceiros"
            className="link-toque flex-none whitespace-nowrap text-sm text-muted hover:text-text"
          >
            Parceiros
          </Link>
          {isAdmin && (
            <Link
              href="/inspetor"
              className="link-toque flex-none whitespace-nowrap border border-line text-sm font-medium text-muted hover:border-gold-lo/60 hover:text-gold-hi"
            >
              Inspetor
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export { AppHeaderSpokesperson as AppHeaderPortaVoz };
