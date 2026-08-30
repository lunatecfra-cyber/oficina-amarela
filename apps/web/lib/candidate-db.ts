import { type Candidate, DEFAULT_TINT, type SocialLinks } from "@oficina/domain/candidates";
import { isValidPhoto, LIMITS, limitList, limitOrNull, limitStr } from "@oficina/domain/limits";
import { sql } from "@/lib/db";

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
  tituloEleitor?: string;
};

export type OnboardingCandidato = CandidateOnboarding;

export async function readCandidateOnboarding(userId: number): Promise<CandidateOnboarding | null> {
  const [l] = await sql`
    SELECT nome, foto_url, cargo, disputa_por, ano_eleicao, localizacao,
           bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
           perfil_completo, marca_dagua, cnpj_campanha, titulo_eleitor
    FROM users WHERE id = ${userId}
  `;
  if (!l) return null;
  return {
    name: l.nome ?? "",
    avatarUrl: l.foto_url ?? "",
    photoUrl: l.foto_url ?? "",
    role: l.cargo ?? "",
    politicalOffice: l.cargo ?? "",
    runningFor: l.disputa_por ?? "",
    electionYear: l.ano_eleicao ?? "2026",
    location: l.localizacao ?? "",
    causes: l.bandeiras ?? [],
    campaignFlags: l.bandeiras ?? [],
    communicationTone: l.tom_comunicacao ?? "",
    keywords: l.palavras_chave ?? [],
    socialLinks: (l.redes_sociais ?? {}) as SocialLinks,
    bio: l.bio ?? "",
    profileComplete: l.perfil_completo ?? false,
    profileCompleted: l.perfil_completo ?? false,
    watermark: l.marca_dagua ?? undefined,
    campaignTaxId: l.cnpj_campanha ?? undefined,
    voterId: l.titulo_eleitor ?? undefined,
    // aliases
    nome: l.nome ?? "",
    fotoUrl: l.foto_url ?? "",
    cargo: l.cargo ?? "",
    disputaPor: l.disputa_por ?? "",
    anoEleicao: l.ano_eleicao ?? "2026",
    localizacao: l.localizacao ?? "",
    bandeiras: l.bandeiras ?? [],
    tomComunicacao: l.tom_comunicacao ?? "",
    palavrasChave: l.palavras_chave ?? [],
    redes: (l.redes_sociais ?? {}) as SocialLinks,
    perfilCompleto: l.perfil_completo ?? false,
    marcaDagua: l.marca_dagua ?? undefined,
    cnpjCampanha: l.cnpj_campanha ?? undefined,
    tituloEleitor: l.titulo_eleitor ?? undefined,
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
    tituloEleitor?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const rawName = data.name ?? data.nome ?? "";
  const name = limitStr(rawName, LIMITS.name);
  if (!name) return { ok: false, error: "Digite seu nome.", erro: "Digite seu nome." };

  const photo = data.avatarUrl ?? data.photoUrl ?? data.fotoUrl;
  if (!isValidPhoto(photo)) {
    return {
      ok: false,
      error: "A foto precisa ser imagem e ter menos de 1,5 MB.",
      erro: "A foto precisa ser imagem e ter menos de 1,5 MB.",
    };
  }

  const office = data.politicalOffice ?? data.role ?? data.cargo;
  if (!office?.trim()) return { ok: false, error: "Escolha o cargo.", erro: "Escolha o cargo." };

  const loc = data.location ?? data.localizacao;
  if (!loc?.trim()) return { ok: false, error: "Preencha a região.", erro: "Preencha a região." };

  const running = data.runningFor ?? data.disputaPor;
  const year = data.electionYear ?? data.anoEleicao ?? "2026";
  const flags = data.campaignFlags ?? data.causes ?? data.bandeiras;
  const tone = data.communicationTone ?? data.tomComunicacao;
  const kw = data.keywords ?? data.palavrasChave;
  const links = data.socialLinks ?? data.redes ?? {};
  const bio = data.bio;
  const watermark = data.watermark ?? data.marcaDagua;
  const campaignTaxId = data.campaignTaxId ?? data.cnpjCampanha;
  const voterId = data.voterId ?? data.tituloEleitor;

  await sql`
    UPDATE users SET
      nome = ${name},
      foto_url = ${photo?.trim() || null},
      cargo = ${limitOrNull(office, LIMITS.tag)},
      disputa_por = ${limitOrNull(running, LIMITS.tag)},
      ano_eleicao = ${limitOrNull(year, 4)},
      localizacao = ${limitOrNull(loc, LIMITS.location)},
      bandeiras = ${limitList(flags, 12)},
      tom_comunicacao = ${limitOrNull(tone, LIMITS.tag)},
      palavras_chave = ${limitList(kw, 8)},
      redes_sociais = ${sql.json(links)},
      bio = ${limitOrNull(bio, LIMITS.bio)},
      marca_dagua = ${limitOrNull(watermark, LIMITS.briefField)},
      cnpj_campanha = ${limitOrNull(campaignTaxId, LIMITS.briefField)},
      titulo_eleitor = ${limitOrNull(voterId, LIMITS.briefField)},
      perfil_completo = true
    WHERE id = ${userId}
  `;

  return { ok: true };
}

export const salvarOnboardingCandidato = saveCandidateOnboarding;

type CandidateRow = {
  id: number;
  apelido: string;
  nome: string;
  foto_url: string | null;
  cargo: string | null;
  disputa_por: string | null;
  ano_eleicao: string | null;
  localizacao: string | null;
  bandeiras: string[] | null;
  tom_comunicacao: string | null;
  palavras_chave: string[] | null;
  redes_sociais: SocialLinks | null;
  bio: string | null;
  criado_em: string;
  marca_dagua: string | null;
  cnpj_campanha: string | null;
  titulo_eleitor: string | null;
};

function rowToCandidate(l: CandidateRow): Candidate {
  return {
    slug: l.apelido,
    name: l.nome,
    role: l.cargo ?? "Porta-voz",
    photoUrl: l.foto_url ?? undefined,
    politicalOffice: l.cargo ?? "",
    runningFor: l.disputa_por ?? undefined,
    electionYear: l.ano_eleicao ?? undefined,
    location: l.localizacao ?? "",
    proximity: 0,
    bio: l.bio ?? "",
    tint: DEFAULT_TINT,
    communicationTone: l.tom_comunicacao ?? undefined,
    campaignFlags: l.bandeiras ?? [],
    keywords: l.palavras_chave ?? [],
    socialLinks: l.redes_sociais ?? {},
    since: new Date(l.criado_em).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    watermark: l.marca_dagua ?? undefined,
    campaignTaxId: l.cnpj_campanha ?? undefined,
    voterId: l.titulo_eleitor ?? undefined,
    // aliases
    nome: l.nome,
    foto: l.foto_url ?? undefined,
    fotoUrl: l.foto_url ?? undefined,
    cargo: l.cargo ?? "",
    disputaPor: l.disputa_por ?? undefined,
    anoEleicao: l.ano_eleicao ?? undefined,
    local: l.localizacao ?? "",
    bandeiras: l.bandeiras ?? [],
    tomComunicacao: l.tom_comunicacao ?? undefined,
    palavrasChave: l.palavras_chave ?? [],
    redes: l.redes_sociais ?? {},
    desde: new Date(l.criado_em).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    marcaDagua: l.marca_dagua ?? undefined,
    cnpjCampanha: l.cnpj_campanha ?? undefined,
    tituloEleitor: l.titulo_eleitor ?? undefined,
  };
}

export async function readOwnCandidate(userId: number): Promise<Candidate | null> {
  const [l] = await sql`
    SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
           localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
           criado_em, marca_dagua, cnpj_campanha, titulo_eleitor
    FROM users
    WHERE id = ${userId}
  `;
  if (!l) return null;
  return rowToCandidate(l as CandidateRow);
}

export const lerCandidatoProprio = readOwnCandidate;

export async function readPublicCandidate(slug: string): Promise<Candidate | null> {
  const [l] = await sql`
    SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
           localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
           criado_em, marca_dagua, cnpj_campanha, titulo_eleitor
    FROM users
    WHERE lower(apelido) = lower(${slug}) AND papel IN ('voz', 'spokesperson') AND perfil_completo = true AND banido = false
  `;
  if (!l) return null;
  return rowToCandidate(l as CandidateRow);
}

export const lerCandidatoPublico = readPublicCandidate;

export async function readCandidatesByHandles(handles: string[]): Promise<Map<string, Candidate>> {
  if (handles.length === 0) return new Map();
  const rows = await sql`
    SELECT id, apelido, nome, foto_url, cargo, disputa_por, ano_eleicao,
           localizacao, bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
           criado_em, marca_dagua, cnpj_campanha, titulo_eleitor
    FROM users
    WHERE apelido = ANY(${handles})
  `;
  const map = new Map<string, Candidate>();
  for (const r of rows) {
    map.set(r.apelido, rowToCandidate(r as CandidateRow));
  }
  return map;
}

export const lerCandidatosPorApelidos = readCandidatesByHandles;
