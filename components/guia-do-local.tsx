"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { DemoGuia } from "@/components/demo-guia";
import { chaveVisto, guiaDaRota, type PassoGuia, type Roteiro } from "@/lib/guia";

type Caixa = { topo: number; esq: number; larg: number; alt: number };

const MARGEM = 12;
const LARGURA_BALAO = 340;

/**
 * O "Como usar" de cada tela: um botão no cabeçalho e, quando aberto, um
 * recorte de luz no elemento com um balão explicando.
 *
 * Abre sozinho na PRIMEIRA vez que a pessoa chega naquela tela e nunca mais —
 * a marca fica no localStorage, por tela e por versão do roteiro. Não vai pro
 * banco de propósito: seria uma migração e uma escrita a cada passo pra
 * guardar algo que não faz falta se a pessoa trocar de aparelho.
 */
export function GuiaDoLocal() {
  const rota = usePathname();
  // useMemo não é enfeite aqui: `guiaDaRota` devolve um objeto NOVO a cada
  // chamada. Sem memo, `roteiro` mudava de identidade a cada render, o
  // `abrir` mudava junto, e o efeito de primeira visita remontava o
  // temporizador sem parar — o guia voltava sozinho pro passo 1 a cada 900ms.
  const roteiro = useMemo(() => guiaDaRota(rota ?? ""), [rota]);

  const [aberto, setAberto] = useState(false);
  const [passos, setPassos] = useState<PassoGuia[]>([]);
  const [i, setI] = useState(0);
  const [caixa, setCaixa] = useState<Caixa | null>(null);
  // `bico` sai daqui junto com a posição de propósito: medir a largura do
  // balão na hora de desenhar seria ler o ref durante o render
  const [pos, setPos] = useState<{
    topo: number;
    esq: number;
    lado: "cima" | "baixo";
    bico: number;
  } | null>(null);

  const balaoRef = useRef<HTMLDivElement>(null);

  /** só entram os passos cujo alvo existe AGORA — fila vazia não tem cartão */
  const passosVisiveis = useCallback((r: Roteiro) => {
    return r.passos.filter((p) => document.querySelector(`[data-guia="${p.alvo}"]`));
  }, []);

  const abrir = useCallback(() => {
    if (!roteiro) return;
    const lista = passosVisiveis(roteiro);
    if (lista.length === 0) return;
    setPassos(lista);
    setI(0);
    setAberto(true);
  }, [roteiro, passosVisiveis]);

  const fechar = useCallback(() => {
    setAberto(false);
    setCaixa(null);
    setPos(null);
    if (roteiro) {
      try {
        localStorage.setItem(chaveVisto(roteiro), "1");
      } catch {
        // navegador com armazenamento bloqueado: só perde o "já vi"
      }
    }
  }, [roteiro]);

  // primeira visita à tela: abre sozinho, depois de a página assentar
  useEffect(() => {
    if (!roteiro) return;
    let visto = true;
    try {
      visto = localStorage.getItem(chaveVisto(roteiro)) === "1";
    } catch {
      // sem localStorage, não insiste
    }
    if (visto) return;
    const t = setTimeout(abrir, 900);
    return () => clearTimeout(t);
  }, [roteiro, abrir]);

  // acompanha o alvo do passo atual: rola até ele e mede
  useEffect(() => {
    if (!aberto || !passos[i]) return;
    const alvo = document.querySelector(`[data-guia="${passos[i].alvo}"]`);
    if (!alvo) return;

    alvo.scrollIntoView({ block: "center", behavior: "smooth" });

    const medir = () => {
      const r = alvo.getBoundingClientRect();
      setCaixa({ topo: r.top - 6, esq: r.left - 6, larg: r.width + 12, alt: r.height + 12 });
    };
    medir();

    // a rolagem é suave, então a posição só para de mudar depois de um tempo:
    // acompanha quadro a quadro por meio segundo em vez de medir uma vez e
    // deixar o recorte parado no lugar errado
    let vivo = true;
    const ate = performance.now() + 600;
    const quadro = () => {
      if (!vivo) return;
      medir();
      if (performance.now() < ate) requestAnimationFrame(quadro);
    };
    requestAnimationFrame(quadro);

    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      vivo = false;
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, [aberto, passos, i]);

  // põe o balão acima ou abaixo do alvo, conforme a sobra de tela
  useLayoutEffect(() => {
    if (!caixa || !balaoRef.current) return;
    const alt = balaoRef.current.offsetHeight;
    const larg = balaoRef.current.offsetWidth;
    const cabeEmbaixo = caixa.topo + caixa.alt + MARGEM + alt < window.innerHeight - MARGEM;
    const topo = cabeEmbaixo ? caixa.topo + caixa.alt + MARGEM : caixa.topo - MARGEM - alt;
    const centro = caixa.esq + caixa.larg / 2 - larg / 2;
    const esq = Math.max(MARGEM, Math.min(centro, window.innerWidth - larg - MARGEM));
    setPos({
      topo: Math.max(MARGEM, Math.min(topo, window.innerHeight - alt - MARGEM)),
      esq,
      lado: cabeEmbaixo ? "baixo" : "cima",
      bico: Math.max(14, Math.min(caixa.esq + caixa.larg / 2 - esq - 6, larg - 26)),
    });
  }, [caixa, i]);

  // teclado: Esc sai, setas andam
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, passos.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, fechar, passos.length]);

  useEffect(() => {
    if (aberto) balaoRef.current?.focus();
  }, [aberto, i]);

  if (!roteiro) return null;

  const passo = passos[i];
  const ultimo = i === passos.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label={`Como usar: ${roteiro.titulo}`}
        className="flex min-h-11 flex-none items-center gap-1.5 rounded-full border border-line px-2.5 text-xs font-medium text-muted transition-colors hover:border-gold-lo/60 hover:text-gold-hi sm:px-3"
      >
        <span aria-hidden="true" className="text-sm leading-none">
          ?
        </span>
        <span className="hidden sm:inline">Como usar</span>
      </button>

      {/* sem guarda de "montou": `aberto` só vira true por toque ou por
          temporizador, os dois no cliente. O render do servidor nunca chega
          no portal, então não tem o que descasar na hidratação. */}
      {aberto &&
        passo &&
        createPortal(
          <div role="dialog" aria-modal="true" aria-label={`Como usar: ${roteiro.titulo}`}>
            {/* pano de fundo: clicar fora sai do guia */}
            <button
              type="button"
              aria-label="Fechar o guia"
              onClick={fechar}
              className="fixed inset-0 z-[59] cursor-default"
            />

            {caixa && (
              <div
                className="guia-foco"
                style={{
                  top: caixa.topo,
                  left: caixa.esq,
                  width: caixa.larg,
                  height: caixa.alt,
                }}
              />
            )}

            <div
              ref={balaoRef}
              tabIndex={-1}
              className="guia-balao max-h-[calc(100dvh-24px)] overflow-y-auto rounded-2xl border border-gold-lo/60 bg-surface-2 p-4 shadow-2xl outline-none"
              style={{
                top: pos?.topo ?? -9999,
                left: pos?.esq ?? -9999,
                width: `min(${LARGURA_BALAO}px, calc(100vw - ${MARGEM * 2}px))`,
              }}
            >
              {pos && (
                <span
                  aria-hidden="true"
                  className="guia-bico"
                  data-lado={pos.lado}
                  style={{ left: pos.bico }}
                />
              )}

              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-gold">
                {roteiro.titulo} · {i + 1} de {passos.length}
              </p>
              <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-lg font-semibold leading-snug text-text">
                {passo.titulo}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{passo.texto}</p>

              {passo.demo && <DemoGuia tipo={passo.demo} />}

              <div className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={fechar}
                  className="min-h-11 flex-none px-1 text-xs text-muted-2 transition-colors hover:text-silver-hi"
                >
                  {ultimo ? "Fechar" : "Pular"}
                </button>
                <div className="flex-1" />
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => setI(i - 1)}
                    className="btn-ghost min-h-11 w-auto px-3 py-2 text-xs"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => (ultimo ? fechar() : setI(i + 1))}
                  className="btn-gold min-h-11 w-auto px-4 py-2 text-xs"
                >
                  {ultimo ? "Entendi" : "Próximo"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
