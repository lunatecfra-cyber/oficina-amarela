"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Revela o conteúdo quando ele entra na tela, não quando a página carrega.
 *
 * A classe `.reveal` do globals.css anima tudo de uma vez, no load — então o
 * que está lá embaixo já terminou de aparecer antes de alguém chegar nele, e o
 * efeito se perde. Aqui a animação espera a pessoa rolar até ali.
 *
 * Observa uma vez e desliga: reanimar a cada passada distrai, e mantém
 * observador vivo à toa.
 *
 * Quem pediu menos movimento no sistema não recebe nenhum — o conteúdo já
 * nasce visível, e nem chegamos a observar.
 */
export function AoAparecer({
  children,
  atraso = 0,
  className = "",
}: {
  children: React.ReactNode;
  /** ms, pra escalonar itens de uma mesma lista */
  atraso?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // Quem pediu menos movimento vê tudo de uma vez. A checagem fica aqui, e
    // não no valor inicial do estado, porque `matchMedia` não existe no
    // servidor — ler ali quebraria a renderização antes de chegar no navegador.
    const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = ref.current;

    if (menosMovimento || !el) {
      // num quadro à parte: mudar estado no mesmo instante em que o efeito roda
      // encadeia renderizações e o próprio lint reclama disso
      const t = requestAnimationFrame(() => setVisivel(true));
      return () => cancelAnimationFrame(t);
    }

    // já está na tela quando a página abre? aparece sem esperar rolagem
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        setVisivel(true);
        obs.disconnect();
      },
      // 12% do bloco visível já dispara, e a margem negativa embaixo evita que
      // algo encoste no rodapé da tela e anime "por acidente"
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} transition-[opacity,transform] duration-700 ease-out ${
        visivel ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
      style={{ transitionDelay: `${atraso}ms` }}
    >
      {children}
    </div>
  );
}
