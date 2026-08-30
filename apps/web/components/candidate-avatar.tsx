import { type Candidate, type Candidato, initials } from "@oficina/domain/candidates";

export function CandidateAvatar({
  candidate,
  candidato,
  className = "h-24 w-24 text-3xl",
}: {
  candidate?: Candidate;
  candidato?: Candidato;
  className?: string;
}) {
  const cand = candidate ?? candidato;
  if (!cand) return null;

  const photo = cand.photo ?? (cand as any).foto;
  const name = cand.name ?? (cand as any).nome;
  const tint = cand.tint;

  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        className={`flex-none rounded-2xl object-cover ${className}`}
        style={{
          boxShadow:
            "0 0 0 4px var(--color-ink), 0 0 0 5px rgba(244,206,31,0.55), 0 12px 34px rgba(0,0,0,0.6)",
        }}
      />
    );
  }

  return (
    <span
      className={`grid flex-none place-items-center rounded-2xl font-[family-name:var(--font-display)] font-semibold text-black/80 ${className}`}
      style={{
        background: tint,
        boxShadow:
          "0 0 0 4px var(--color-ink), 0 0 0 5px rgba(244,206,31,0.55), 0 12px 34px rgba(0,0,0,0.6)",
      }}
    >
      {initials(name)}
    </span>
  );
}

export { CandidateAvatar as AvatarCandidato };
