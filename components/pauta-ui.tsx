"use client";

// Pedacinhos de UI compartilhados entre as telas que mostram uma missão.
//
// Moraram em fila-pautas.tsx enquanto o editor navegava por uma lista. Com o
// dispatch essa lista deixou de existir, mas o inspetor e o card de oferta
// continuam precisando destes três — então vieram pra cá, sem o resto.
import { ROTULO_STATUS, type Pauta } from "@/lib/pautas";
import { getCandidato, type Candidato } from "@/lib/candidatos";

/**
 * Missão real (tem apelido) busca o perfil de verdade no mapa vindo do
 * servidor; missão de demonstração (sem apelido) cai no CANDIDATOS fake.
 * Sem isso, toda missão real aparecia com avatar cinza e cargo vazio.
 */
export function candidatoDaPauta(
  p: Pauta,
  mapa: Record<string, Candidato>
): Candidato {
  if (p.portaVozApelido && mapa[p.portaVozApelido]) return mapa[p.portaVozApelido];
  return getCandidato(p.portaVoz);
}

export function Selo({ status }: { status: Pauta["status"] }) {
  const cor =
    status === "minha"
      ? "border-gold-lo/60 bg-gold/10 text-gold-hi"
      : status === "disponivel"
        ? "border-line bg-surface-2 text-muted"
        : status === "oferecida"
          ? "border-gold-lo/40 bg-gold/[0.07] text-gold-hi"
          : status === "reservada"
            ? "border-silver-hi/40 bg-silver-hi/5 text-silver-hi"
            : status === "em_revisao"
              ? "border-silver-lo/50 bg-surface-2 text-silver"
              : status === "aprovada" || status === "finalizada"
                ? "border-ok/50 bg-ok/10 text-ok"
                : status === "reedicao"
                  ? "border-danger/50 bg-danger/10 text-danger"
                  : "border-line bg-surface text-muted-2";

  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cor}`}>
      {ROTULO_STATUS[status]}
    </span>
  );
}

export function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="rounded-md border border-line-soft bg-surface px-2 py-0.5 text-[11px] text-muted">
      <span className="text-muted-2">{k}:</span> {v}
    </span>
  );
}
