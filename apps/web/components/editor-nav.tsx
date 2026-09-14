"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/editor", label: "Fila", rotulo: "Fila" },
  { href: "/agenda", label: "Agenda", rotulo: "Agenda" },
  { href: "/aulas", label: "Aulas", rotulo: "Aulas" },
  { href: "/ferramentas", label: "Ferramentas", rotulo: "Ferramentas" },
  { href: "/ranking", label: "Ranking", rotulo: "Ranking" },
  { href: "/parceiros?source=editor", label: "Parceiros", rotulo: "Parceiros" },
];

export function EditorNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação do editor" className="flex w-max min-w-full items-center gap-1 text-xs sm:text-sm">
      {TABS.map((tab) => {
        const path = tab.href.split("?")[0];
        const active = pathname === path || pathname.startsWith(`${path}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-11 flex-none items-center justify-center whitespace-nowrap rounded-[4px] px-2.5 py-1.5 transition-colors ${
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
