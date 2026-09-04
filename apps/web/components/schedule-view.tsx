"use client";

import { type TaskOnDesk, type TrabalhoEmMaos } from "@oficina/domain/schedule";
import Link from "next/link";
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
        <p className="mt-1 text-sm text-muted">Acompanhe as missões que estão na sua mesa.</p>
      </div>

      <section className="mt-8" data-guia="mesa-agora">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-gold">
          Na sua mesa agora
        </h2>
        {list.length === 0 ? (
          <div className="border-y border-line py-6 text-center">
            <p className="text-sm text-muted">Nada em andamento.</p>
            <Link href="/editor" className="btn-gold mt-4 w-auto px-5">
              Ver missões disponíveis
            </Link>
          </div>
        ) : (
          <ActiveDesk tasks={list} variant="cards" />
        )}
      </section>
    </div>
  );
}

export { ScheduleView as AgendaView };
