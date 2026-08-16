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
  { href: "/ranking", rotulo: "Ranking" },
  { href: "/parceiros", rotulo: "Parceiros" },
];

export function NavEditor() {
  const pathname = usePathname();

  return (
    // No celular as abas dividem a largura por igual, o que dá alvo grande pro
    // dedo sem depender do tamanho da palavra. `min-h-11` garante os 44px que
    // a mão acerta de primeira.
    <nav className="flex items-center gap-1 text-sm">
      {ABAS.map((aba) => {
        const ativa = pathname === aba.href || pathname.startsWith(`${aba.href}/`);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`relative flex min-h-11 flex-1 items-center justify-center rounded-lg px-2.5 py-1.5 transition-colors sm:flex-none ${
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
