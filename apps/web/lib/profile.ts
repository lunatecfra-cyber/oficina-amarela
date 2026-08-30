import type { Formato, VideoFormat } from "@/lib/missions";

export type Tier = "Aprendiz" | "Oficial" | "Artífice" | "Mestre-Artesão";
export type Nivel = Tier;

export const SOFTWARE_TOOLS = [
  "Premiere",
  "After Effects",
  "DaVinci Resolve",
  "CapCut",
  "Final Cut",
  "Photoshop",
] as const;
export const SOFTWARES = SOFTWARE_TOOLS;

export const EDITING_STYLES = [
  "Reels dinâmico",
  "Vlog / conversacional",
  "Político sóbrio",
  "Documental",
  "Motion / gráfico",
  "Corte de live",
] as const;
export const ESTILOS = EDITING_STYLES;
export const STYLES = EDITING_STYLES;
export const MAX_STYLES = 3;
export const MAX_ESTILOS = 3;

export const HEADLINES: { category: string; categoria: string; tags: readonly string[] }[] = [
  {
    category: "Tipo de edição",
    categoria: "Tipo de edição",
    tags: [
      "Edição dinâmica",
      "Cortes impactantes",
      "Storytelling visual",
      "Montagem cinematográfica",
      "Corte de live / podcast",
      "Vlog e conteúdo autoral",
      "Compilado / highlights",
      "Vídeo de reação",
    ],
  },
  {
    category: "Formato",
    categoria: "Formato",
    tags: [
      "Criação de Shorts/Reels",
      "Edição vertical",
      "Edição horizontal",
      "Vídeo curto (até 60s)",
      "Vídeo médio (1–5 min)",
      "Longa-metragem / documentário",
    ],
  },
  {
    category: "Estilo e ritmo",
    categoria: "Estilo e ritmo",
    tags: [
      "Ritmo rápido",
      "Ritmo calmo / pausado",
      "Pós-produção completa",
      "Colorização e finalização",
      "Motion design",
      "Letreiros e tipografia animada",
    ],
  },
  {
    category: "Áudio e trilha",
    categoria: "Áudio e trilha",
    tags: [
      "Trilha e sincronização",
      "Mixagem e limpeza de áudio",
      "Sound design",
      "Seleção musical",
    ],
  },
  {
    category: "Nicho político",
    categoria: "Nicho político",
    tags: [
      "Propaganda eleitoral",
      "Discurso ao vivo",
      "Clipe de campanha",
      "Bastidores de campanha",
      "Debate político",
      "Cobertura de eventos",
    ],
  },
];

export const ALL_HEADLINES = HEADLINES.flatMap((g) => g.tags);
export const TODAS_HEADLINES = ALL_HEADLINES;

export const MAX_HEADLINES = 5;

export type OptionWithPhrase = { label: string; phrase: string; rotulo: string; frase: string };
export type OpcaoComFrase = OptionWithPhrase;

export const EDITING_LEVELS: OptionWithPhrase[] = [
  {
    label: "Iniciante",
    phrase: "Tô aprendendo do zero, sei nada ainda",
    rotulo: "Iniciante",
    frase: "Tô aprendendo do zero, sei nada ainda",
  },
  {
    label: "Intermediário",
    phrase: "Já editei alguns vídeos para candidatos e canais",
    rotulo: "Intermediário",
    frase: "Já editei alguns vídeos para candidatos e canais",
  },
  {
    label: "Avançado",
    phrase: "Dominador das ferramentas, edito de olhos fechados",
    rotulo: "Avançado",
    frase: "Dominador das ferramentas, edito de olhos fechados",
  },
];
export const NIVEIS_EDICAO = EDITING_LEVELS;

export const PC_SETUPS: OptionWithPhrase[] = [
  {
    label: "📱 Celular/Tablet",
    phrase: "Uso CapCut móvel e aplicativos rápidos",
    rotulo: "📱 Celular/Tablet",
    frase: "Uso CapCut móvel e aplicativos rápidos",
  },
  {
    label: "🥔 PC Batata",
    phrase: "Chora e trava se eu tentar abrir o Premiere",
    rotulo: "🥔 PC Batata",
    frase: "Chora e trava se eu tentar abrir o Premiere",
  },
  {
    label: "⚙️ PC Médio",
    phrase: "Dá pro gasto usando proxies e paciência",
    rotulo: "⚙️ PC Médio",
    frase: "Dá pro gasto usando proxies e paciência",
  },
  {
    label: "🚀 PC Monstro",
    phrase: "Renderiza 4K liso sem reclamar",
    rotulo: "🚀 PC Monstro",
    frase: "Renderiza 4K liso sem reclamar",
  },
];
export const SETUPS_PC = PC_SETUPS;

export const NICHES: OptionWithPhrase[] = [
  {
    label: "Vertical (9:16)",
    phrase: "Reels, Shorts e TikToks dinâmicos de alta retenção",
    rotulo: "Vertical (9:16)",
    frase: "Reels, Shorts e TikToks dinâmicos de alta retenção",
  },
  {
    label: "Horizontal (16:9)",
    phrase: "Documentários, vídeos de canal e institucionais sóbrios",
    rotulo: "Horizontal (16:9)",
    frase: "Documentários, vídeos de canal e institucionais sóbrios",
  },
];
export const NICHOS = NICHES;

export const TIERS: { name: Tier; nome: Tier; minimum: number; minimo: number }[] = [
  { name: "Aprendiz", nome: "Aprendiz", minimum: 0, minimo: 0 },
  { name: "Oficial", nome: "Oficial", minimum: 10, minimo: 10 },
  { name: "Artífice", nome: "Artífice", minimum: 30, minimo: 30 },
  { name: "Mestre-Artesão", nome: "Mestre-Artesão", minimum: 60, minimo: 60 },
];
export const NIVEIS = TIERS;

export function levelProgress(deliveredCount: number) {
  let current = TIERS[0];
  let next: (typeof TIERS)[number] | null = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (deliveredCount >= TIERS[i].minimum) {
      current = TIERS[i];
      next = TIERS[i + 1] ?? null;
    }
  }
  if (!next)
    return {
      current,
      atual: current,
      next: null,
      proximo: null,
      pct: 100,
      remaining: 0,
      faltam: 0,
    };
  const range = next.minimum - current.minimum;
  const done = deliveredCount - current.minimum;
  const pct = Math.round((done / range) * 100);
  const remaining = next.minimum - deliveredCount;
  return {
    current,
    atual: current,
    next,
    proximo: next,
    pct,
    remaining,
    faltam: remaining,
  };
}
export const progressoNivel = levelProgress;

export type PortfolioItem = {
  id: string;
  title: string;
  format: VideoFormat;
  spokesperson: string;
  tint: string;
  // aliases
  titulo?: string;
  formato?: Formato;
  portaVoz?: string;
};
export type ItemPortfolio = PortfolioItem;

export type HistoryItem = {
  id: string;
  title: string;
  spokesperson: string;
  date: string;
  result: "approved" | "revision_requested" | "aprovada" | "reedicao";
  // aliases
  titulo?: string;
  portaVoz?: string;
  data?: string;
  resultado?: "approved" | "revision_requested" | "aprovada" | "reedicao";
};
export type ItemHistorico = HistoryItem;

export type EditorProfile = {
  handle: string;
  name: string;
  headline: string[];
  location: string;
  since: string;
  bio: string;
  photoUrl?: string;
  avatarUrl?: string;
  softwares?: string[];
  softwareTools?: string[];
  styles?: string[];
  editingStyles?: string[];
  niche?: string[];
  niches?: string[];
  editingLevel?: string;
  pcSetup?: string;
  deliveries?: number;
  deliveredCount?: number;
  rating: number | null;
  tier?: Tier;
  level?: Tier;
  reputation: number;
  streak: number;
  portfolio: PortfolioItem[];
  history: HistoryItem[];
  achievements: { icon: string; name: string; icone?: string; nome?: string }[];
  // aliases
  apelido?: string;
  nome?: string;
  local?: string;
  desde?: string;
  fotoUrl?: string;
  estilos?: string[];
  nicho?: string[];
  nivelEdicao?: string;
  setupPc?: string;
  entregues?: number;
  nota?: number | null;
  nivel?: Tier;
  reputacao?: number;
  historico?: HistoryItem[];
  conquistas?: { icone: string; nome: string; icon?: string; name?: string }[];
};
export type PerfilEditor = EditorProfile;

export const DEFAULT_EDITOR_PROFILE: EditorProfile = {
  handle: "jr.eneias",
  name: "Jr. Eneias",
  headline: ["Editor de vídeo", "Cortes impactantes"],
  location: "Petrópolis, RJ",
  since: "março de 2026",
  bio: "Corto rápido e no ritmo. Especialidade em short de reação e clipe de fala forte. Gosto de tom direto, legenda bold e áudio limpo.",
  softwares: ["Premiere", "After Effects"],
  styles: ["Reels dinâmico", "Corte de live"],
  niche: ["Vertical (9:16)"],
  editingLevel: "Avançado",
  pcSetup: "🚀 PC Monstro",
  deliveries: 12,
  deliveredCount: 12,
  rating: 4.8,
  reputation: 340,
  streak: 5,
  portfolio: [
    {
      id: "pf-1",
      title: "Corte do debate sobre saneamento",
      format: "short",
      spokesperson: "Busnelo",
      tint: "linear-gradient(135deg,#3a3a42,#1a1a24)",
      titulo: "Corte do debate sobre saneamento",
      formato: "short",
      portaVoz: "Busnelo",
    },
  ],
  history: [
    {
      id: "h-1",
      title: "Corte sobre segurança do bairro",
      spokesperson: "Busnelo",
      date: "23 jul 2026",
      result: "approved",
      titulo: "Corte sobre segurança do bairro",
      portaVoz: "Busnelo",
      data: "23 jul 2026",
      resultado: "aprovada",
    },
  ],
  achievements: [
    { icon: "⚡", name: "Entrega em menos de 2h", icone: "⚡", nome: "Entrega em menos de 2h" },
    {
      icon: "🎯",
      name: "10 aprovações sem refação",
      icone: "🎯",
      nome: "10 aprovações sem refação",
    },
    { icon: "🔥", name: "Ritmo de 5 dias seguidos", icone: "🔥", nome: "Ritmo de 5 dias seguidos" },
  ],
  apelido: "jr.eneias",
  nome: "Jr. Eneias",
  local: "Petrópolis, RJ",
  desde: "março de 2026",
  estilos: ["Reels dinâmico", "Corte de live"],
  nicho: ["Vertical (9:16)"],
  nivelEdicao: "Avançado",
  setupPc: "🚀 PC Monstro",
  entregues: 12,
  nota: 4.8,
  reputacao: 340,
  historico: [
    {
      id: "h-1",
      title: "Corte sobre segurança do bairro",
      spokesperson: "Busnelo",
      date: "23 jul 2026",
      result: "aprovada",
      titulo: "Corte sobre segurança do bairro",
      portaVoz: "Busnelo",
      data: "23 jul 2026",
      resultado: "aprovada",
    },
  ],
  conquistas: [
    { icon: "⚡", name: "Entrega em menos de 2h", icone: "⚡", nome: "Entrega em menos de 2h" },
    {
      icon: "🎯",
      name: "10 aprovações sem refação",
      icone: "🎯",
      nome: "10 aprovações sem refação",
    },
    { icon: "🔥", name: "Ritmo de 5 dias seguidos", icone: "🔥", nome: "Ritmo de 5 dias seguidos" },
  ],
};
export const PERFIL_EDITOR = DEFAULT_EDITOR_PROFILE;

export type EditorRanking = {
  id: number;
  handle: string;
  level: Tier;
  deliveredCount: number;
  reputation: number;
  streak: number;
  // aliases
  apelido?: string;
  nivel?: Tier;
  entregues?: number;
  reputacao?: number;
};
export type RankingEditor = EditorRanking;
