"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/inspetor", label: "Missões", rotulo: "Missões" },
  { href: "/inspetor/panorama", label: "Panorama", rotulo: "Panorama" },
  { href: "/inspetor/contas", label: "Pessoas", rotulo: "Pessoas" },
  { href: "/inspetor/denuncias", label: "Denúncias", rotulo: "Denúncias" },
  { href: "/inspetor/novidades", label: "Novidades", rotulo: "Novidades" },
  { href: "/inspetor/seguranca", label: "Segurança", rotulo: "Segurança" },
  { href: "/parceiros", label: "Parceiros", rotulo: "Parceiros" },
];

export function InspectorNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        href="/porta-voz"
        className="mr-2 flex min-h-11 flex-none items-center whitespace-nowrap pr-1 text-xs text-muted/60 transition-colors hover:text-text"
      >
        ← Porta-voz
      </Link>
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-11 flex-none items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors ${
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

export { InspectorNav as NavInspetor };
