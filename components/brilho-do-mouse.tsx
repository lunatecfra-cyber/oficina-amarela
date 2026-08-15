"use client";

import { useEffect, useRef } from "react";

/**
 * Um halo dourado que segue o mouse na abertura.
 *
 * Escolhi isto no lugar de trocar o cursor: cursor customizado atrapalha mais
 * do que enfeita — some o contexto de "isto é clicável", e em tela de toque não
 * existe cursor nenhum. Um brilho que reage ao movimento dá a mesma sensação de
 * vida sem tirar nada de ninguém.
 *
 * Três cuidados, porque isto roda na página mais visitada:
 *
 *  - só liga onde existe mouse de verdade (`hover: hover`). Em celular o
 *    componente nem se monta.
 *  - a posição vai por variável CSS e o desenho é feito pela GPU. Nada de
 *    recalcular layout a cada pixel do mouse.
 *  - quem pediu menos movimento no sistema não recebe nada.
 */
export function BrilhoDoMouse() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const temMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const menosMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!temMouse || menosMovimento) return;

    const el = ref.current;
    if (!el) return;
    const secao = el.parentElement;
    if (!secao) return;

    let pendente = 0;

    const mover = (e: MouseEvent) => {
      // um quadro por vez: mousemove dispara muito mais rápido que a tela
      // desenha, e sem isto o trabalho se acumula à toa
      if (pendente) return;
      pendente = requestAnimationFrame(() => {
        pendente = 0;
        const r = secao.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        el.style.opacity = "1";
      });
    };

    const sair = () => {
      el.style.opacity = "0";
    };

    secao.addEventListener("mousemove", mover);
    secao.addEventListener("mouseleave", sair);
    return () => {
      secao.removeEventListener("mousemove", mover);
      secao.removeEventListener("mouseleave", sair);
      if (pendente) cancelAnimationFrame(pendente);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500"
      style={{
        background:
          "radial-gradient(280px circle at var(--mx, 50%) var(--my, 30%), rgba(244,206,31,0.09), transparent 65%)",
      }}
    />
  );
}
