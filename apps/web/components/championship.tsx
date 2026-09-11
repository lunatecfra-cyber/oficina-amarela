"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ELECTORAL_AWARDS } from "@oficina/domain/electoral-ranking";

export function Championship() {
  const [data, setData] = useState<{ activeEditors: number; awards: string[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/championship", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        const value = await response.json();
        if (!Number.isInteger(value.activeEditors) || !Array.isArray(value.awards)) throw new Error("invalid");
        setData(value);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  return <section id="campeonato" className="mx-auto max-w-6xl border-b border-line px-6 py-12 lg:px-8">
    <p className="mb-3 text-sm font-semibold text-gold">RANKING ELEITORAL · ATÉ 25/10/2026</p>
    <h2>Campeonato de edição</h2>
    <p className="mt-4 max-w-2xl text-base leading-relaxed text-silver">Cada vídeo aprovado conta. Participe das missões, evolua como editor e dispute sua posição. Mais editores ativos liberam novas premiações.</p>
    <p className="mt-4 text-sm text-silver" role="status">{data ? `${data.activeEditors} editores ativos nesta semana` : failed ? "Não foi possível consultar os prêmios agora. Confira novamente no ranking." : "Consultando premiações…"}</p>
    <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {ELECTORAL_AWARDS.map((award) => <li key={award.key} className="border-t border-line pt-4">
        <p className="text-sm text-silver">{award.activeThreshold} editores ativos</p>
        <h3 className="mt-2 text-lg font-semibold">{award.key === "sorteio_constancia" ? "Outro ingresso" : award.award}</h3>
        <p className="mt-1 text-sm text-silver">{award.target}</p>
        <p className="mt-3 text-sm font-medium text-gold">{data ? data.awards.includes(award.key) ? "Liberado" : "Bloqueado" : "Liberação a confirmar"}</p>
      </li>)}
    </ul>
    <p className="mt-6 max-w-2xl text-sm leading-relaxed text-silver">A classificação conta vídeos aprovados, não XP de acessos ou indicações. Editor ativo cumpre a meta semanal de entregas aprovadas.</p>
    <Link href="/ranking" className="btn-gold mt-6 max-w-xs">Ver ranking e regras</Link>
  </section>;
}
