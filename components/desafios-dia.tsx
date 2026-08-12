"use client";

import { useState } from "react";
import { DESAFIOS_HOJE, type Desafio } from "@/lib/perfil";

function Dificuldade({ nivel }: { nivel: 1 | 2 | 3 }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`dificuldade ${nivel} de 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${i <= nivel ? "bg-gold" : "bg-line"}`}
        />
      ))}
    </span>
  );
}

export function DesafiosDia() {
  const [desafios, setDesafios] = useState<Desafio[]>(DESAFIOS_HOJE);

  const marcar = (id: string) =>
    setDesafios((lista) =>
      lista.map((d) => (d.id === id ? { ...d, cumprido: !d.cumprido } : d))
    );

  const feitos = desafios.filter((d) => d.cumprido).length;

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          {/* "encomenda" era vocabulário solto: em tela tudo é missão */}
          <h2 className="text-xs font-medium uppercase tracking-[0.14em] text-gold">
            Desafios do dia
          </h2>
          <p className="mt-1 text-xs text-muted-2">
            XP extra por manter o ritmo. Independe da missão que você está fazendo.
          </p>
        </div>
        <span className="flex-none text-xs text-muted">
          {feitos}/{desafios.length}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {desafios.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => marcar(d.id)}
            aria-pressed={d.cumprido}
            className={`rounded-2xl border p-4 text-left transition-colors ${
              d.cumprido
                ? "border-ok/40 bg-ok/[0.06]"
                : "border-line bg-surface/60 hover:border-gold/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Dificuldade nivel={d.dificuldade} />
              <span className="rounded-md border border-gold-lo/40 bg-gold/[0.08] px-1.5 py-0.5 text-[10px] font-medium text-gold-hi">
                +{d.xp} XP
              </span>
            </div>
            <p className={`mt-2 text-sm font-medium ${d.cumprido ? "text-muted line-through" : "text-text"}`}>
              {d.titulo}
            </p>
            <p className="mt-1 text-xs text-muted-2">{d.descricao}</p>
            {d.cumprido && (
              <p className="mt-2 text-xs font-medium text-ok">✓ Cumprido</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
