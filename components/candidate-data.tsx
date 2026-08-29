import type { Candidate, Candidato } from "@/lib/candidates";
import { ProximityLocation } from "@/components/proximity-location";
import { IconInstagram, IconTiktok, IconX, IconYoutube } from "@/components/social-icons";

export function CandidateData({
  candidate,
  candidato,
}: {
  candidate?: Candidate;
  candidato?: Candidato;
}) {
  const cand = candidate ?? candidato;
  if (!cand) return null;

  const role = cand.role ?? (cand as any).cargo;
  const runningFor = cand.runningFor ?? (cand as any).disputaPor;
  const electionYear = cand.electionYear ?? (cand as any).anoEleicao;
  const location = cand.location ?? (cand as any).local;
  const proximity = cand.proximity ?? (cand as any).proximidade ?? 0;
  const socialLinks = cand.socialLinks ?? (cand as any).redes;
  const bio = cand.bio;
  const tone = cand.communicationTone ?? (cand as any).tomComunicacao;
  const flags = cand.causes ?? (cand as any).bandeiras;
  const keywords = cand.keywords ?? (cand as any).palavrasChave;

  const hasSocials = !!(socialLinks?.instagram || socialLinks?.youtube || socialLinks?.tiktok || socialLinks?.x);

  return (
    <>
      <p className="mt-1 text-gold-hi">
        {role}
        {runningFor && <span className="text-muted-2"> — {runningFor}</span>}
        {electionYear && <span className="text-muted-2"> · {electionYear}</span>}
      </p>
      <ProximityLocation
        location={location}
        proximity={proximity}
        className="mt-1 text-sm text-muted-2"
      />
      {hasSocials && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-2">
          {socialLinks?.instagram && (
            <span className="inline-flex items-center gap-1">
              <IconInstagram className="h-3.5 w-3.5" />
              {socialLinks.instagram}
            </span>
          )}
          {socialLinks?.youtube && (
            <span className="inline-flex items-center gap-1">
              <IconYoutube className="h-3.5 w-3.5" />
              {socialLinks.youtube}
            </span>
          )}
          {socialLinks?.tiktok && (
            <span className="inline-flex items-center gap-1">
              <IconTiktok className="h-3.5 w-3.5" />
              {socialLinks.tiktok}
            </span>
          )}
          {socialLinks?.x && (
            <span className="inline-flex items-center gap-1">
              <IconX className="h-3.5 w-3.5" />
              {socialLinks.x}
            </span>
          )}
        </div>
      )}
      {bio && (
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{bio}</p>
      )}
      {(tone || (flags && flags.length > 0)) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tone && (
            <span className="inline-block rounded-full border border-gold-lo/40 bg-gold/[0.07] px-2.5 py-0.5 text-[11px] text-gold-hi">
              tom: {tone}
            </span>
          )}
          {flags?.map((b: string) => (
            <span
              key={b}
              className="inline-block rounded-full border border-gold-lo/30 bg-gold/10 px-2.5 py-0.5 text-[11px] text-gold-hi"
            >
              {b}
            </span>
          ))}
        </div>
      )}
      {keywords && keywords.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {keywords.map((p: string) => (
            <span
              key={p}
              className="inline-block rounded-full border border-line px-2.5 py-0.5 text-[11px] italic text-muted-2"
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

export { CandidateData as DadosCandidato };
