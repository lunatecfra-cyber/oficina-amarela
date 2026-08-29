"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// A navegação precisa saber em qual aba você está, e só o cliente sabe a
// rota atual — por isso este pedaço é "use client" enquanto o AppHeader
// continua sendo Server Component (ele busca perfil no banco).

const ABAS = [
  { href: "/editor", rotulo: "Fila" },
  { href: "/agenda", rotulo: "Agenda" },
  { href: "/aulas", rotulo: "Aulas" },
  { href: "/ferramentas", rotulo: "Ferramentas" },
  { href: "/ranking", rotulo: "Ranking" },
  { href: "/parceiros", rotulo: "Parceiros" },
];

export function NavEditor() {
  const pathname = usePathname();

  return (
    // No celular as abas repartem a largura PROPORCIONALMENTE ao rótulo
    // (`flex-auto`, base no conteúdo) em vez de em fatias iguais (`flex-1`).
    // Com fatias iguais, "Ferramentas" precisava de 69px numa caixa de 51px
    // úteis e transbordava por cima das abas vizinhas — medido em 390px.
    // `min-h-11` continua garantindo os 44px que a mão acerta de primeira.
    <nav className="flex w-full min-w-0 items-center gap-1 text-[11px] sm:w-auto sm:text-sm">
      {ABAS.map((aba) => {
        const ativa = pathname === aba.href || pathname.startsWith(`${aba.href}/`);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`relative flex min-h-11 min-w-0 flex-auto items-center justify-center whitespace-nowrap rounded-lg px-1 py-1.5 transition-colors sm:flex-none sm:px-2.5 ${
              ativa ? "text-text" : "text-muted hover:text-text"
            }`}
          >
            {aba.rotulo}
            {ativa && (
              <span
                aria-hidden="true"
                className="absolute inset-x-2.5 -bottom-0.5 h-px rounded-full bg-gradient-to-r from-transparent via-gold to-transparent"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
