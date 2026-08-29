"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { GuideDemo } from "@/components/guide-demo";
import { seenKey, getRouteGuide, type GuideStep, type RouteScript } from "@/lib/guide";

type Box = { top: number; left: number; width: number; height: number };

const MARGIN = 12;
const BALLOON_WIDTH = 340;

export function LocalGuide() {
  const pathname = usePathname();
  const script = useMemo(() => getRouteGuide(pathname ?? ""), [pathname]);

  const [isOpen, setIsOpen] = useState(false);
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    side: "top" | "bottom";
    beak: number;
  } | null>(null);

  const balloonRef = useRef<HTMLDivElement>(null);

  const visibleSteps = useCallback((r: RouteScript) => {
    const list = r.steps ?? (r as any).passos ?? [];
    return list.filter((p: any) => {
      const target = p.target ?? p.alvo;
      return document.querySelector(`[data-guia="${target}"]`) || document.querySelector(`[data-guide="${target}"]`);
    });
  }, []);

  const open = useCallback(() => {
    if (!script) return;
    const list = visibleSteps(script);
    if (list.length === 0) return;
    setSteps(list);
    setIndex(0);
    setIsOpen(true);
  }, [script, visibleSteps]);

  const close = useCallback(() => {
    setIsOpen(false);
    setBox(null);
    setPos(null);
    if (script) {
      try {
        localStorage.setItem(seenKey(script), "1");
      } catch {
        // storage blocked
      }
    }
  }, [script]);

  useEffect(() => {
    if (!script) return;
    let seen = true;
    try {
      seen = localStorage.getItem(seenKey(script)) === "1";
    } catch {
      // storage blocked
    }
    if (seen) return;
    const t = setTimeout(open, 900);
    return () => clearTimeout(t);
  }, [script, open]);

  useEffect(() => {
    if (!isOpen || !steps[index]) return;
    const stepTarget = steps[index].target ?? (steps[index] as any).alvo;
    const targetEl =
      document.querySelector(`[data-guia="${stepTarget}"]`) ||
      document.querySelector(`[data-guide="${stepTarget}"]`);
    if (!targetEl) return;

    targetEl.scrollIntoView({ block: "center", behavior: "smooth" });

    const measure = () => {
      const r = targetEl.getBoundingClientRect();
      setBox({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
    };
    measure();

    let alive = true;
    const until = performance.now() + 600;
    const frame = () => {
      if (!alive) return;
      measure();
      if (performance.now() < until) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      alive = false;
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [isOpen, steps, index]);

  useLayoutEffect(() => {
    if (!box || !balloonRef.current) return;
    const h = balloonRef.current.offsetHeight;
    const w = balloonRef.current.offsetWidth;
    const fitsBottom = box.top + box.height + MARGIN + h < window.innerHeight - MARGIN;
    const top = fitsBottom ? box.top + box.height + MARGIN : box.top - MARGIN - h;
    const center = box.left + box.width / 2 - w / 2;
    const left = Math.max(MARGIN, Math.min(center, window.innerWidth - w - MARGIN));
    setPos({
      top: Math.max(MARGIN, Math.min(top, window.innerHeight - h - MARGIN)),
      left,
      side: fitsBottom ? "bottom" : "top",
      beak: Math.max(14, Math.min(box.left + box.width / 2 - left - 6, w - 26)),
    });
  }, [box, index]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") setIndex((v) => Math.min(v + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIndex((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, close, steps.length]);

  useEffect(() => {
    if (isOpen) balloonRef.current?.focus();
  }, [isOpen, index]);

  if (!script) return null;

  const currentStep = steps[index];
  const isLast = index === steps.length - 1;
  const scriptTitle = script.title ?? (script as any).titulo;

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label={`Como usar: ${scriptTitle}`}
        className="flex min-h-11 flex-none items-center gap-1.5 rounded-full border border-line px-2.5 text-xs font-medium text-muted transition-colors hover:border-gold-lo/60 hover:text-gold-hi sm:px-3"
      >
        <span aria-hidden="true" className="text-sm leading-none">
          ?
        </span>
        <span className="hidden sm:inline">Como usar</span>
      </button>

      {isOpen &&
        currentStep &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={`Como usar: ${scriptTitle}`}>
            <button
              type="button"
              aria-label="Fechar o guia"
              onClick={close}
              className="fixed inset-0 z-[59] cursor-default"
            />

            {box && (
              <div
                className="guia-foco"
                style={{
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                }}
              />
            )}

            <div
              ref={balloonRef}
              tabIndex={-1}
              className="guia-balao max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-gold-lo/60 bg-surface-2 p-4 shadow-2xl outline-none"
              style={{
                top: pos?.top ?? -9999,
                left: pos?.left ?? -9999,
                width: `min(${BALLOON_WIDTH}px, calc(100vw - ${MARGIN * 2}px))`,
              }}
            >
              {pos && (
                <span
                  aria-hidden="true"
                  className="guia-bico"
                  data-lado={pos.side === "bottom" ? "baixo" : "cima"}
                  style={{ left: pos.beak }}
                />
              )}

              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gold">
                {scriptTitle} · {index + 1} de {steps.length}
              </p>
              <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-lg font-semibold leading-snug text-text">
                {currentStep.title ?? (currentStep as any).titulo}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {currentStep.text ?? (currentStep as any).texto}
              </p>

              {(currentStep.demo ?? (currentStep as any).demo) && (
                <GuideDemo type={(currentStep.demo ?? (currentStep as any).demo)!} />
              )}

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={close}
                  className="min-h-11 flex-none px-1 text-xs text-muted-2 transition-colors hover:text-silver-hi"
                >
                  {isLast ? "Fechar" : "Pular"}
                </button>
                <div className="flex-1" />
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => setIndex(index - 1)}
                    className="btn-ghost min-h-11 w-auto px-3 py-2 text-xs"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (isLast ? close() : setIndex(index + 1))}
                  className="btn-gold min-h-11 w-auto px-4 py-2 text-xs"
                >
                  {isLast ? "Entendi" : "Próximo"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export { LocalGuide as GuiaDoLocal };
