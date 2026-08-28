"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/editor", label: "Fila", rotulo: "Fila" },
  { href: "/schedule", label: "Agenda", rotulo: "Agenda" },
  { href: "/lessons", label: "Aulas", rotulo: "Aulas" },
  { href: "/tools", label: "Ferramentas", rotulo: "Ferramentas" },
  { href: "/leaderboard", label: "Ranking", rotulo: "Ranking" },
  { href: "/partners", label: "Parceiros", rotulo: "Parceiros" },
];

export function EditorNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-full min-w-0 items-center gap-1 text-[11px] sm:w-auto sm:text-sm">
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-lg px-1 py-1.5 transition-colors sm:flex-none sm:px-2.5 ${
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
