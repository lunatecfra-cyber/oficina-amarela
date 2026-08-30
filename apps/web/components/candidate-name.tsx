import type { Candidate, Candidato } from "@oficina/domain/candidates";

export function CandidateName({
  candidate,
  candidato,
  className = "",
}: {
  candidate?: Candidate;
  candidato?: Candidato;
  className?: string;
}) {
  const cand = candidate ?? candidato;
  if (!cand) return null;
  const name = cand.name ?? (cand as any).nome;
  return <h1 className={className}>{name}</h1>;
}

export { CandidateName as NomeCandidato };
