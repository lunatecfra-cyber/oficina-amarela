"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Mesma ideia do NavEditor: o Server Component (layout) não sabe a rota
// atual, só o cliente sabe. Este pedaço client resolve a aba ativa.

const ABAS = [
  { href: "/inspetor", rotulo: "Missões" },
  { href: "/inspetor/panorama", rotulo: "Panorama" },
  { href: "/inspetor/contas", rotulo: "Pessoas" },
  { href: "/inspetor/denuncias", rotulo: "Denúncias" },
  { href: "/inspetor/novidades", rotulo: "Novidades" },
  { href: "/parceiros", rotulo: "Parceiros" },
];

export function NavInspetor() {
  const pathname = usePathname();

  return (
    // Com cinco abas os rótulos não cabem em 390px. Em vez de encolher a
    // fonte (e perder o alvo do dedo), a tira rola sozinha — só ela, nunca a
    // página. `min-h-11` mantém os 44px que a mão acerta.
    <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {ABAS.map((aba) => {
        const ativa = pathname === aba.href || pathname.startsWith(`${aba.href}/`);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`relative flex min-h-11 flex-none items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 transition-colors ${
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
