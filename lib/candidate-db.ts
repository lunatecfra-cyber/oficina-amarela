import { sql } from "@/lib/db";
import { LIMITS, isValidPhoto, limitStr, limitList, limitOrNull } from "@/lib/limits";
import { DEFAULT_TINT, type Candidate, type SocialLinks } from "@/lib/candidates";
import { validateCampaignIdentity } from "@/lib/campaign-identity";

export type CandidateOnboarding = {
  name: string;
  avatarUrl?: string;
  photoUrl?: string;
  role?: string;
  politicalOffice?: string;
  runningFor?: string;
  electionYear?: string;
  location?: string;
  causes?: string[];
  campaignFlags?: string[];
  communicationTone?: string;
  keywords?: string[];
  socialLinks?: SocialLinks;
  bio?: string;
  profileComplete?: boolean;
  profileCompleted?: boolean;
  watermark?: string;
  campaignTaxId?: string;
  candidateNumber?: string;
  voterId?: string;
  // compatibility aliases
  nome?: string;
  fotoUrl?: string;
  cargo?: string;
  disputaPor?: string;
  anoEleicao?: string;
  localizacao?: string;
  bandeiras?: string[];
  tomComunicacao?: string;
  palavrasChave?: string[];
  redes?: SocialLinks;
  perfilCompleto?: boolean;
  marcaDagua?: string;
  cnpjCampanha?: string;
  numeroEleitoral?: string;
  tituloEleitor?: string;
};

export type OnboardingCandidato = CandidateOnboarding;

export async function readCandidateOnboarding(userId: number): Promise<CandidateOnboarding | null> {
  const [l] = await sql`
    SELECT name, avatar_url, political_office, running_for, election_year, location,
           campaign_flags, communication_tone, keywords, social_links, bio,
           profile_completed, watermark, campaign_tax_id, candidate_number, voter_id
    FROM users WHERE id = ${userId}
  `;
  if (!l) return null;
  return {
    name: l.name ?? "",
    avatarUrl: l.avatar_url ?? "",
    photoUrl: l.avatar_url ?? "",
    role: l.political_office ?? "",
    politicalOffice: l.political_office ?? "",
    runningFor: l.running_for ?? "",
    electionYear: l.election_year ?? "2026",
    location: l.location ?? "",
    causes: l.campaign_flags ?? [],
    campaignFlags: l.campaign_flags ?? [],
    communicationTone: l.communication_tone ?? "",
    keywords: l.keywords ?? [],
    socialLinks: (l.social_links ?? {}) as SocialLinks,
    bio: l.bio ?? "",
    profileComplete: l.profile_completed ?? false,
    profileCompleted: l.profile_completed ?? false,
    watermark: l.watermark ?? undefined,
    campaignTaxId: l.campaign_tax_id ?? undefined,
    candidateNumber: l.candidate_number ?? undefined,
    voterId: l.voter_id ?? undefined,
    // aliases
    nome: l.name ?? "",
    fotoUrl: l.avatar_url ?? "",
    cargo: l.political_office ?? "",
    disputaPor: l.running_for ?? "",
    anoEleicao: l.election_year ?? "2026",
    localizacao: l.location ?? "",
    bandeiras: l.campaign_flags ?? [],
    tomComunicacao: l.communication_tone ?? "",
    palavrasChave: l.keywords ?? [],
    redes: (l.social_links ?? {}) as SocialLinks,
    perfilCompleto: l.profile_completed ?? false,
    marcaDagua: l.watermark ?? undefined,
    cnpjCampanha: l.campaign_tax_id ?? undefined,
    numeroEleitoral: l.candidate_number ?? undefined,
    tituloEleitor: l.voter_id ?? undefined,
  };
}

export const lerOnboardingCandidato = readCandidateOnboarding;

export async function saveCandidateOnboarding(
  userId: number,
  data: {
    name?: string;
    photoUrl?: string;
    avatarUrl?: string;
    role?: string;
    politicalOffice?: string;
    runningFor?: string;
    electionYear?: string;
    location?: string;
    causes?: string[];
    policyFlags?: string[];
    campaignFlags?: string[];
    communicationTone?: string;
    keywords?: string[];
    socialLinks?: SocialLinks;
    bio?: string;
    watermark?: string;
    watermarkUrl?: string;
    campaignTaxId?: string;
    candidateNumber?: string;
    voterId?: string;
    voterRegistrationId?: string;
    // aliases
    nome?: string;
    fotoUrl?: string;
    cargo?: string;
    disputaPor?: string;
    anoEleicao?: string;
    localizacao?: string;
    bandeiras?: string[];
    tomComunicacao?: string;
    palavrasChave?: string[];
    redes?: SocialLinks;
    marcaDagua?: string;
    cnpjCampanha?: string;
    numeroEleitoral?: string;
    tituloEleitor?: string;
  }
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const rawName = data.name ?? data.nome ?? "";
  const identity = validateCampaignIdentity({
    officialName: rawName,
    candidateNumber: data.candidateNumber ?? data.numeroEleitoral ?? "",
    campaignTaxId: data.campaignTaxId ?? data.cnpjCampanha ?? "",
  });
  if (!identity.ok) return { ok: false, error: identity.error, erro: identity.error };
  const name = limitStr(identity.value.officialName, LIMITS.name);

  const photo = data.avatarUrl ?? data.photoUrl ?? data.fotoUrl;
  if (!isValidPhoto(photo)) {
    return { ok: false, error: "Photo must be a valid image under 1.5MB.", erro: "Invalid photo." };
  }

  const office = data.politicalOffice ?? data.role ?? data.cargo;
  const running = data.runningFor ?? data.disputaPor;
  const year = data.electionYear ?? data.anoEleicao ?? "2026";
  const loc = data.location ?? data.localizacao;
  const flags = data.campaignFlags ?? data.causes ?? data.bandeiras;
  const tone = data.communicationTone ?? data.tomComunicacao;
  const kw = data.keywords ?? data.palavrasChave;
  const links = data.socialLinks ?? data.redes ?? {};
  const bio = data.bio;
  const watermark = data.watermark ?? data.marcaDagua;
  const campaignTaxId = identity.value.campaignTaxId;
  const candidateNumber = identity.value.candidateNumber;
  const voterId = data.voterId ?? data.tituloEleitor;

  await sql`
    UPDATE users SET
      name = ${name},
      avatar_url = ${photo?.trim() || null},
      political_office = ${limitOrNull(office, LIMITS.tag)},
      running_for = ${limitOrNull(running, LIMITS.tag)},
      election_year = ${limitOrNull(year, 4)},
      location = ${limitOrNull(loc, LIMITS.location)},
      campaign_flags = ${limitList(flags, 12)},
      communication_tone = ${limitOrNull(tone, LIMITS.tag)},
      keywords = ${limitList(kw, 8)},
      social_links = ${sql.json(links)},
      bio = ${limitOrNull(bio, LIMITS.bio)},
      watermark = ${limitOrNull(watermark, LIMITS.name)},
      campaign_tax_id = ${limitOrNull(campaignTaxId, LIMITS.name)},
      candidate_number = ${candidateNumber},
      voter_id = ${limitOrNull(voterId, LIMITS.name)},
      profile_completed = true
    WHERE id = ${userId}
  `;

  return { ok: true };
}

export const salvarOnboardingCandidato = saveCandidateOnboarding;

type CandidateRow = {
  id: number;
  handle: string;
  name: string;
  avatar_url: string | null;
  political_office: string | null;
  running_for: string | null;
  election_year: string | null;
  location: string | null;
  campaign_flags: string[] | null;
  communication_tone: string | null;
  keywords: string[] | null;
  social_links: SocialLinks | null;
  bio: string | null;
  created_at: string;
  watermark: string | null;
  campaign_tax_id: string | null;
  candidate_number: string | null;
  voter_id: string | null;
};

function rowToCandidate(l: CandidateRow): Candidate {
  return {
    slug: l.handle,
    name: l.name,
    role: l.political_office ?? "Porta-voz",
    photoUrl: l.avatar_url ?? undefined,
    politicalOffice: l.political_office ?? "",
    runningFor: l.running_for ?? undefined,
    electionYear: l.election_year ?? undefined,
    location: l.location ?? "",
    proximity: 0,
    bio: l.bio ?? "",
    tint: DEFAULT_TINT,
    communicationTone: l.communication_tone ?? undefined,
    campaignFlags: l.campaign_flags ?? [],
    keywords: l.keywords ?? [],
    socialLinks: l.social_links ?? {},
    since: new Date(l.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    watermark: l.watermark ?? undefined,
    campaignTaxId: l.campaign_tax_id ?? undefined,
    candidateNumber: l.candidate_number ?? undefined,
    voterId: l.voter_id ?? undefined,
    // aliases
    nome: l.name,
    foto: l.avatar_url ?? undefined,
    fotoUrl: l.avatar_url ?? undefined,
    cargo: l.political_office ?? "",
    disputaPor: l.running_for ?? undefined,
    anoEleicao: l.election_year ?? undefined,
    local: l.location ?? "",
    bandeiras: l.campaign_flags ?? [],
    tomComunicacao: l.communication_tone ?? undefined,
    palavrasChave: l.keywords ?? [],
    redes: l.social_links ?? {},
    desde: new Date(l.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    marcaDagua: l.watermark ?? undefined,
    cnpjCampanha: l.campaign_tax_id ?? undefined,
    numeroEleitoral: l.candidate_number ?? undefined,
    tituloEleitor: l.voter_id ?? undefined,
  };
}

export async function readOwnCandidate(userId: number): Promise<Candidate | null> {
  const [l] = await sql`
    SELECT id, handle, name, avatar_url, political_office, running_for, election_year,
           location, campaign_flags, communication_tone, keywords, social_links, bio,
           created_at, watermark, campaign_tax_id, candidate_number, voter_id
    FROM users
    WHERE id = ${userId}
  `;
  if (!l) return null;
  return rowToCandidate(l as CandidateRow);
}

export const lerCandidatoProprio = readOwnCandidate;

export async function readPublicCandidate(slug: string): Promise<Candidate | null> {
  const [l] = await sql`
    SELECT id, handle, name, avatar_url, political_office, running_for, election_year,
           location, campaign_flags, communication_tone, keywords, social_links, bio,
           created_at, watermark, campaign_tax_id, candidate_number, voter_id
    FROM users
    WHERE lower(handle) = lower(${slug}) AND role = 'spokesperson' AND profile_completed = true AND is_banned = false
  `;
  if (!l) return null;
  return rowToCandidate(l as CandidateRow);
}

export const lerCandidatoPublico = readPublicCandidate;

export async function readCandidatesByHandles(handles: string[]): Promise<Map<string, Candidate>> {
  if (handles.length === 0) return new Map();
  const rows = await sql`
    SELECT id, handle, name, avatar_url, political_office, running_for, election_year,
           location, campaign_flags, communication_tone, keywords, social_links, bio,
           created_at, watermark, campaign_tax_id, candidate_number, voter_id
    FROM users
    WHERE handle = ANY(${handles})
  `;
  const map = new Map<string, Candidate>();
  for (const r of rows) {
    map.set(r.handle, rowToCandidate(r as CandidateRow));
  }
  return map;
}

export const lerCandidatosPorApelidos = readCandidatesByHandles;
