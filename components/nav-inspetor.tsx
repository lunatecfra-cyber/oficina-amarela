"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mesma ideia do NavEditor: o Server Component (layout) não sabe a rota
// atual, só o cliente sabe. Este pedaço client resolve a aba ativa.

const ABAS = [
  { href: "/inspetor", rotulo: "Missões" },
  { href: "/inspetor/contas", rotulo: "Pessoas" },
];

export function NavInspetor() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {ABAS.map((aba) => {
        const ativa = pathname === aba.href || pathname.startsWith(`${aba.href}/`);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`relative rounded-lg px-2.5 py-1.5 transition-colors ${
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
