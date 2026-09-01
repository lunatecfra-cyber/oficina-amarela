"use client";

import { useEffect, useRef } from "react";

export function MouseGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!hasMouse || reducedMotion) return;

    const el = ref.current;
    if (!el) return;
    const section = el.parentElement;
    if (!section) return;

    let pending = 0;

    const onMove = (e: MouseEvent) => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        const r = section.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        el.style.opacity = "1";
      });
    };

    const onLeave = () => {
      el.style.opacity = "0";
    };

    section.addEventListener("mousemove", onMove);
    section.addEventListener("mouseleave", onLeave);
    return () => {
      section.removeEventListener("mousemove", onMove);
      section.removeEventListener("mouseleave", onLeave);
      if (pending) cancelAnimationFrame(pending);
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
