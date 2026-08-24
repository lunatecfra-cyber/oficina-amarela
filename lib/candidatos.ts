export type RedesSociais = {
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  x?: string;
};

export type Candidato = {
  slug: string;
  nome: string;
  cargo: string;
  disputaPor?: string; // por onde disputa o cargo (ex: "Rio de Janeiro")
  anoEleicao?: string; // ano em que vai ser eleito (ex: "2026")
  redes?: RedesSociais;
  tomComunicacao?: string; // como ele se comunica (vem da análise de perfil)
  bandeiras?: string[]; // temas/pautas principais (ex: "Segurança", "Educação")
  palavrasChave?: string[]; // até 3 palavras que definem a postura do candidato
  local: string;
  proximidade: number; // 0 = longe (cinza), 1 = pertinho (amarelo)
  bio: string;
  tint: string; // fundo do avatar
  foto?: string; // foto de perfil (data URL), quando o candidato monta o próprio perfil
  desde?: string; // na guilda desde quando (porta-voz)
  // padrões para regras do TSE
  marcaDagua?: string;
  cnpjCampanha?: string;
  tituloEleitor?: string;
};

// tint padrão pra candidato real (sem noção de "proximidade" — isso sempre
// foi um dado de demonstração dos 2 CANDIDATOS fake abaixo)
export const TINT_PADRAO = "linear-gradient(135deg,#3a3a42,#12121a)";

// eleição de 2026 é geral (estadual/federal) — sem prefeito/vereador, que são municipais (2028)
export const CARGOS_POLITICOS = [
  "Deputado Estadual",
  "Deputado Federal",
  "Senador",
  "Governador",
] as const;

// vocabulário de tom já usado nos briefs de pauta (lib/pautas.ts) — reaproveitado
// aqui pra análise de perfil virar o tom padrão das missões desse candidato
export const TONS_COMUNICACAO = [
  "Direto e firme",
  "Sóbrio",
  "Empático",
  "Ágil",
  "Leve",
] as const;

// uma frase de exemplo por tom, pra ajudar o candidato a escolher o que mais
// se parece com o jeito dele de falar
export const EXEMPLOS_TOM: Record<(typeof TONS_COMUNICACAO)[number], string> = {
  "Direto e firme": "Chega de enrolação: o problema é esse, e é assim que a gente resolve.",
  Sóbrio: "Analisamos os números com calma antes de prometer qualquer coisa.",
  Empático: "Eu sei que não é fácil. Vamos passar por isso juntos.",
  Ágil: "Rápido: gravou hoje de manhã, já foi ao ar à tarde.",
  Leve: "Sem drama, sem discurso pronto — só a real, do nosso jeito.",
};

export const ANOS_ELEICAO = ["2026", "2028", "2030", "2032", "2034"] as const;

export const BANDEIRAS_TEMAS = [
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

export const PALAVRAS_CHAVE_SUGERIDAS = [
  "Transparente",
  "Combativo",
  "Próximo do povo",
  "Técnico",
  "Ousado",
  "Conciliador",
  "Persistente",
  "Acessível",
] as const;

// frase de fechamento da bio automática, uma por tom — mesmo espírito de
// EXEMPLOS_TOM, mas escrita em primeira pessoa pra encerrar uma bio
const FECHO_BIO_POR_TOM: Record<(typeof TONS_COMUNICACAO)[number], string> = {
  "Direto e firme": "Fala clara, sem rodeio — resultado é o que importa.",
  Sóbrio: "Decisão pensada com calma, sempre baseada em dado e fato.",
  Empático: "Perto das pessoas, ouvindo antes de agir.",
  Ágil: "Rápido pra entender o problema, mais rápido ainda pra resolver.",
  Leve: "Sem discurso pronto — só a real, no dia a dia.",
};

// monta uma sugestão de bio a partir do que já foi preenchido no assistente —
// o candidato pode editar por cima ou pedir outra sugestão
export function gerarBioSugerida(dados: {
  cargo?: string;
  disputaPor?: string;
  local?: string;
  bandeiras?: string[];
  tom?: string;
}): string {
  const onde = dados.disputaPor || dados.local;
  const abertura = dados.cargo
    ? `${dados.cargo}${onde ? ` por ${onde}` : ""}.`
    : onde
      ? `Candidato(a) em ${onde}.`
      : "";

  const temas =
    dados.bandeiras && dados.bandeiras.length > 0
      ? `Foco em ${dados.bandeiras.join(", ")}.`
      : "";

  const fecho = dados.tom
    ? FECHO_BIO_POR_TOM[dados.tom as (typeof TONS_COMUNICACAO)[number]]
    : "";

  return [abertura, temas, fecho].filter(Boolean).join(" ");
}

export { ESTADOS_BRASIL, CIDADES_POR_UF } from "./cidades-br";

export const CANDIDATOS: Record<string, Candidato> = {
  Busnelo: {
    slug: "busnelo",
    nome: "Busnelo",
    cargo: "Porta-voz",
    local: "Petrópolis, RJ",
    proximidade: 0.9,
    bio: "Segurança pública e comunidade. Fala direta, muito conteúdo de rua.",
    tint: "linear-gradient(135deg,#f4ce1f,#a9840e)",
    desde: "fevereiro de 2026",
    tomComunicacao: "Direto e firme",
    bandeiras: ["Segurança", "Infraestrutura"],
    palavrasChave: ["Combativo", "Próximo do povo"],
    redes: { instagram: "@busnelo", youtube: "Busnelo Oficial" },
  },
  "Marcia Lima": {
    slug: "marcia-lima",
    nome: "Marcia Lima",
    cargo: "Porta-voz",
    local: "Nova Friburgo, RJ",
    proximidade: 0.5,
    bio: "Saúde e educação. Tom sóbrio, gosta de entrevista e depoimento.",
    tint: "linear-gradient(135deg,#3a3a42,#12121a)",
    tomComunicacao: "Sóbrio",
    bandeiras: ["Saúde", "Educação"],
    palavrasChave: ["Técnico", "Conciliador"],
    redes: { instagram: "@marcialima", x: "@marcialima" },
  },
};

// porta-vozes cadastrados de verdade não têm entrada em CANDIDATOS (que só tem
// os dois fake de demonstração) — monta um ponto de partida vazio pra eles,
// que o assistente de perfil (criar-perfil) preenche em seguida
function candidatoPadrao(nome: string): Candidato {
  const slug = nome
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return {
    slug,
    nome,
    cargo: "",
    local: "",
    proximidade: 0,
    bio: "",
    tint: "linear-gradient(135deg,#3a3a42,#12121a)",
  };
}

export function getCandidato(nome: string): Candidato {
  return CANDIDATOS[nome] ?? candidatoPadrao(nome);
}

export function getCandidatoPorSlug(slug: string): Candidato | undefined {
  return Object.values(CANDIDATOS).find((c) => c.slug === slug);
}

export function iniciais(nome: string) {
  return nome
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// cor do indicador de proximidade: amarelo (perto) -> cinza escuro (longe)
export function corProximidade(p: number) {
  const pct = Math.round(Math.min(1, Math.max(0, p)) * 100);
  return `color-mix(in srgb, #f4ce1f ${pct}%, #5a5a64)`;
}
