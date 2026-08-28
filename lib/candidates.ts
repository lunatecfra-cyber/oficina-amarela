export type SocialLinks = {
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  x?: string;
};
export type RedesSociais = SocialLinks;

export type Candidate = {
  slug: string;
  name: string;
  role?: string;
  politicalOffice?: string;
  runningFor?: string;
  electionYear?: string;
  socialLinks?: SocialLinks;
  communicationTone?: string;
  causes?: string[];
  campaignFlags?: string[];
  keywords?: string[];
  location: string;
  proximity: number;
  bio: string;
  tint: string;
  photo?: string;
  photoUrl?: string;
  avatarUrl?: string;
  since?: string;
  watermark?: string;
  campaignTaxId?: string;
  voterId?: string;
  // compatibility aliases
  nome?: string;
  cargo?: string;
  disputaPor?: string;
  anoEleicao?: string;
  redes?: SocialLinks;
  tomComunicacao?: string;
  bandeiras?: string[];
  palavrasChave?: string[];
  local?: string;
  proximidade?: number;
  foto?: string;
  fotoUrl?: string;
  desde?: string;
  marcaDagua?: string;
  cnpjCampanha?: string;
  tituloEleitor?: string;
};
export type Candidato = Candidate;

export const DEFAULT_TINT = "linear-gradient(135deg,#3a3a42,#12121a)";
export const TINT_PADRAO = DEFAULT_TINT;

export const POLITICAL_ROLES = [
  "Deputado Estadual",
  "Deputado Federal",
  "Senador",
  "Governador",
  "Prefeito",
  "Vereador",
] as const;
export const POLITICAL_OFFICES = POLITICAL_ROLES;
export const CARGOS_POLITICOS = POLITICAL_ROLES;

export const COMMUNICATION_TONES = [
  "Direto e firme",
  "Sóbrio",
  "Empático",
  "Ágil",
  "Leve",
] as const;
export const TONS_COMUNICACAO = COMMUNICATION_TONES;

export const TONE_EXAMPLES: Record<(typeof COMMUNICATION_TONES)[number], string> = {
  "Direto e firme": "Chega de enrolação: o problema é esse, e é assim que a gente resolve.",
  Sóbrio: "Analisamos os números com calma antes de prometer qualquer coisa.",
  Empático: "Eu sei que não é fácil. Vamos passar por isso juntos.",
  Ágil: "Rápido: gravou hoje de manhã, já foi ao ar à tarde.",
  Leve: "Sem drama, sem discurso pronto — só a real, do nosso jeito.",
};
export const EXEMPLOS_TOM = TONE_EXAMPLES;

export const ELECTION_YEARS = ["2026", "2028", "2030", "2032", "2034"] as const;
export const ANOS_ELEICAO = ELECTION_YEARS;

export const THEME_FLAGS = [
  "Segurança",
  "Educação",
  "Saúde",
  "Economia",
  "Emprego",
  "Meio Ambiente",
  "Infraestrutura",
  "Moradia",
  "Transporte",
  "Cultura",
  "Assistência Social",
  "Tecnologia",
] as const;
export const CAMPAIGN_FLAGS = THEME_FLAGS;
export const BANDEIRAS_TEMAS = THEME_FLAGS;

export const SUGGESTED_KEYWORDS = [
  "Transparente",
  "Combativo",
  "Próximo do povo",
  "Técnico",
  "Ousado",
  "Conciliador",
  "Persistente",
  "Acessível",
] as const;
export const PALAVRAS_CHAVE_SUGERIDAS = SUGGESTED_KEYWORDS;

const BIO_CLOSING_BY_TONE: Record<(typeof COMMUNICATION_TONES)[number], string> = {
  "Direto e firme": "Fala clara, sem rodeio — resultado é o que importa.",
  Sóbrio: "Decisão pensada com calma, sempre baseada em dado e fato.",
  Empático: "Perto das pessoas, ouvindo antes de agir.",
  Ágil: "Rápido pra entender o problema, mais rápido ainda pra resolver.",
  Leve: "Sem discurso pronto — só a real, no dia a dia.",
};

export function generateSuggestedBio(data: {
  role?: string;
  cargo?: string;
  runningFor?: string;
  disputaPor?: string;
  location?: string;
  local?: string;
  causes?: string[];
  bandeiras?: string[];
  tone?: string;
  tom?: string;
}): string {
  const office = data.role || data.cargo;
  const where = data.runningFor || data.disputaPor || data.location || data.local;
  const flags = data.causes || data.bandeiras;
  const selectedTone = data.tone || data.tom;

  const opening = office
    ? `${office}${where ? ` por ${where}` : ""}.`
    : where
      ? `Candidato(a) em ${where}.`
      : "";

  const themes =
    flags && flags.length > 0
      ? `Foco em ${flags.join(", ")}.`
      : "";

  const closing = selectedTone
    ? BIO_CLOSING_BY_TONE[selectedTone as (typeof COMMUNICATION_TONES)[number]]
    : "";

  return [opening, themes, closing].filter(Boolean).join(" ");
}
export const gerarBioSugerida = generateSuggestedBio;

export { BRAZIL_STATES, CITIES_BY_STATE, ESTADOS_BRASIL, CIDADES_POR_UF, BRAZILIAN_STATES } from "./cities";

export const DEMO_CANDIDATES: Record<string, Candidate> = {
  Busnelo: {
    slug: "busnelo",
    name: "Busnelo",
    role: "Porta-voz",
    politicalOffice: "Porta-voz",
    location: "Petrópolis, RJ",
    proximity: 0.9,
    bio: "Segurança pública e comunidade. Fala direta, muito conteúdo de rua.",
    tint: "linear-gradient(135deg,#f4ce1f,#a9840e)",
    since: "fevereiro de 2026",
    communicationTone: "Direto e firme",
    causes: ["Segurança", "Comunidade"],
    keywords: ["Direto", "Firme", "Transparente"],
    socialLinks: { instagram: "@busnelo.oficial", youtube: "Canal do Busnelo" },
    nome: "Busnelo",
    cargo: "Porta-voz",
    local: "Petrópolis, RJ",
    proximidade: 0.9,
    tomComunicacao: "Direto e firme",
    bandeiras: ["Segurança", "Comunidade"],
    palavrasChave: ["Direto", "Firme", "Transparente"],
    redes: { instagram: "@busnelo.oficial", youtube: "Canal do Busnelo" },
    desde: "fevereiro de 2026",
  },
  Valeska: {
    slug: "valeska",
    name: "Valeska",
    role: "Porta-voz",
    politicalOffice: "Porta-voz",
    location: "Petrópolis, RJ",
    proximity: 0.85,
    bio: "Educação e juventude. Vídeos dinâmicos e muita presença nas redes.",
    tint: "linear-gradient(135deg,#e5b81a,#7c5e05)",
    since: "fevereiro de 2026",
    communicationTone: "Ágil",
    causes: ["Educação", "Juventude"],
    keywords: ["Dinâmica", "Juventude", "Educação"],
    socialLinks: { instagram: "@valeska.juventude", tiktok: "@valeska.edu" },
    nome: "Valeska",
    cargo: "Porta-voz",
    local: "Petrópolis, RJ",
    proximidade: 0.85,
    tomComunicacao: "Ágil",
    bandeiras: ["Educação", "Juventude"],
    palavrasChave: ["Dinâmica", "Juventude", "Educação"],
    redes: { instagram: "@valeska.juventude", tiktok: "@valeska.edu" },
    desde: "fevereiro de 2026",
  },
};
export const CANDIDATOS = DEMO_CANDIDATES;
export const CANDIDATES = DEMO_CANDIDATES;

export function getCandidate(name: string): Candidate {
  return (
    DEMO_CANDIDATES[name] ?? {
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      role: "Porta-voz",
      politicalOffice: "Porta-voz",
      location: "Brasil",
      proximity: 0.5,
      bio: "Porta-voz na Oficina Amarela.",
      tint: DEFAULT_TINT,
      nome: name,
      cargo: "Porta-voz",
      local: "Brasil",
      proximidade: 0.5,
    }
  );
}
export const getCandidato = getCandidate;

export function getCandidateBySlug(slug: string): Candidate | null {
  const cand = Object.values(DEMO_CANDIDATES).find((c) => c.slug === slug);
  return cand ?? null;
}
export const getCandidatoPorSlug = getCandidateBySlug;

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}
export const iniciais = initials;

export function proximityColor(p: number): string {
  return p >= 0.8 ? "text-gold-hi" : p >= 0.5 ? "text-gold-lo" : "text-muted-2";
}
export const corProximidade = proximityColor;
