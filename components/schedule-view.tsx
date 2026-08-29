"use client";

import { type TaskOnDesk, type TrabalhoEmMaos } from "@/lib/schedule";
import { ActiveDesk } from "@/components/active-desk";

export function ScheduleView({
  onDesk = [],
  naMesa = [],
}: {
  onDesk?: TaskOnDesk[];
  naMesa?: TrabalhoEmMaos[];
}) {
  const list = onDesk.length > 0 ? onDesk : naMesa;

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
          Sua agenda
        </h1>
        <p className="mt-1 text-sm text-muted">
          Acompanhe as missões que estão na sua mesa.
        </p>
      </div>

      <section className="mt-8" data-guia="mesa-agora">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Na sua mesa agora
        </h2>
        {list.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">
            Nada em andamento. Pegue uma missão na fila.
          </p>
        ) : (
          <ActiveDesk tasks={list} variant="cards" />
        )}
      </section>
    </div>
  );
}

export { ScheduleView as AgendaView };
