"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/editor", label: "Fila", rotulo: "Fila" },
  { href: "/agenda", label: "Agenda", rotulo: "Agenda" },
  { href: "/portfolio", label: "Portfólio", rotulo: "Portfólio" },
  { href: "/aulas", label: "Aulas", rotulo: "Aulas" },
  { href: "/ferramentas", label: "Ferramentas", rotulo: "Ferramentas" },
  { href: "/ranking", label: "Ranking", rotulo: "Ranking" },
  { href: "/parceiros?source=editor", label: "Parceiros", rotulo: "Parceiros" },
];

export function EditorNav() {
  const pathname = usePathname();

  /* `overflow-x-auto`: em 345px as seis abas somem ~370px e sem isso a
     página rola pro lado (DESIGN §5). Com o scroll interno, a lista
     desliza e o resto da página fica parado. */
  return (
    <nav className="flex w-full min-w-0 items-center gap-1 overflow-x-auto text-[11px] sm:w-auto sm:text-sm lg:overflow-visible">
      {TABS.map((tab) => {
        const path = tab.href.split("?")[0];
        const active = pathname === path || pathname.startsWith(`${path}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-11 min-w-0 flex-auto items-center justify-center whitespace-nowrap rounded-lg px-1 py-1.5 transition-colors sm:flex-none sm:px-2.5 ${
              active ? "text-text" : "text-muted hover:text-text"
            }`}
          >
            {tab.label}
            {active && (
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

export { EditorNav as NavEditor };
