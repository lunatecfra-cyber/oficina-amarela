import type { Formato } from "@/lib/pautas";

// mesmos cortes da coluna gerada "nivel" em supabase/schema.sql — se mudar
// aqui, mudar lá também
export type Nivel = "Aprendiz" | "Oficial" | "Artífice" | "Mestre-Artesão";

// o que o editor domina — usado no onboarding e, no futuro, pra casar com o
// requisito técnico da pauta
export const SOFTWARES = [
  "Premiere",
  "After Effects",
  "DaVinci Resolve",
  "CapCut",
  "Final Cut",
  "Photoshop",
] as const;

// estilo de edição — casa com o tom do brief da pauta no match
export const ESTILOS = [
  "Reels dinâmico",
  "Vlog / conversacional",
  "Político sóbrio",
  "Documental",
  "Motion / gráfico",
  "Corte de live",
] as const;

export const MAX_ESTILOS = 3;

// tags de especialidade do editor — usadas no onboarding e no formulário de
// edição de perfil. servem de base pra matching com porta-vozes/candidatos.
// organizadas por categoria; o componente pode renderizar por seção ou flat.
export const HEADLINES: { categoria: string; tags: readonly string[] }[] = [
  {
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
    categoria: "Áudio e trilha",
    tags: [
      "Trilha e sincronização",
      "Mixagem e limpeza de áudio",
      "Sound design",
      "Seleção musical",
    ],
  },
  {
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

// flat list de todas as tags de headline (pra iteração simples)
export const TODAS_HEADLINES = HEADLINES.flatMap((g) => g.tags);

export const MAX_HEADLINES = 5;

export type OpcaoComFrase = { rotulo: string; frase: string };

// auto-avaliação do editor no onboarding — texto solto de propósito (ver
// comentário em supabase/schema.sql), então rotulo é o próprio valor salvo
export const NIVEIS_EDICAO: OpcaoComFrase[] = [
  { rotulo: "Iniciante", frase: "Tô aprendendo do zero, sei nada ainda" },
  { rotulo: "Intermediário", frase: "Já editei alguns vídeos para candidatos e canais" },
  { rotulo: "Avançado", frase: "Dominador das ferramentas, edito de olhos fechados" },
];

export const SETUPS_PC: OpcaoComFrase[] = [
  { rotulo: "📱 Celular/Tablet", frase: "Uso CapCut móvel e aplicativos rápidos" },
  { rotulo: "🥔 PC Batata", frase: "Chora e trava se eu tentar abrir o Premiere" },
  { rotulo: "⚙️ PC Médio", frase: "Dá pro gasto usando proxies e paciência" },
  { rotulo: "🚀 PC Monstro", frase: "Renderiza 4K liso sem reclamar" },
];

export const NICHOS: OpcaoComFrase[] = [
  { rotulo: "Vertical (9:16)", frase: "Reels, Shorts e TikToks dinâmicos de alta retenção" },
  { rotulo: "Horizontal (16:9)", frase: "Documentários, vídeos de canal e institucionais sóbrios" },
];

export const NIVEIS: { nome: Nivel; minimo: number }[] = [
  { nome: "Aprendiz", minimo: 0 },
  { nome: "Oficial", minimo: 10 },
  { nome: "Artífice", minimo: 30 },
  { nome: "Mestre-Artesão", minimo: 60 },
];

export function progressoNivel(entregues: number) {
  let atual = NIVEIS[0];
  let proximo: (typeof NIVEIS)[number] | null = null;
  for (let i = 0; i < NIVEIS.length; i++) {
    if (entregues >= NIVEIS[i].minimo) {
      atual = NIVEIS[i];
      proximo = NIVEIS[i + 1] ?? null;
    }
  }
  if (!proximo) return { atual, proximo: null, pct: 100, faltam: 0 };
  const faixa = proximo.minimo - atual.minimo;
  const feito = entregues - atual.minimo;
  return {
    atual,
    proximo,
    pct: Math.round((feito / faixa) * 100),
    faltam: proximo.minimo - entregues,
  };
}

export type ItemPortfolio = {
  id: string;
  titulo: string;
  formato: Formato;
  portaVoz: string;
  tint: string; // gradiente do thumbnail
};

export type ItemHistorico = {
  id: string;
  titulo: string;
  portaVoz: string;
  data: string;
  resultado: "aprovada" | "reedicao";
};

export type PerfilEditor = {
  apelido: string;
  nome: string;
  headline: string[];
  local: string;
  desde: string;
  bio: string;
  entregues: number;
  nota: number | null; // null = ainda não foi avaliado (não é nota zero)
  nivel?: Nivel; // vem calculado do banco a partir de entregues
  reputacao: number;
  streak: number; // dias seguidos ativo (entregou ou interagiu)
  portfolio: ItemPortfolio[];
  historico: ItemHistorico[];
  conquistas: { icone: string; nome: string }[];
};

export const PERFIL_EDITOR: PerfilEditor = {
  apelido: "jr.eneias",
  nome: "Jr. Eneias",
  headline: ["Editor de vídeo", "Cortes impactantes"],
  local: "Petrópolis, RJ",
  desde: "março de 2026",
  bio: "Corto rápido e no ritmo. Especialidade em short de reação e clipe de fala forte. Gosto de tom direto, legenda bold e áudio limpo.",
  entregues: 12,
  nota: 4.8,
  reputacao: 340,
  streak: 5,
  portfolio: [
    { id: "v1", titulo: "Resposta sobre segurança", formato: "short", portaVoz: "Busnelo", tint: "linear-gradient(135deg,#f4ce1f,#a9840e)" },
    { id: "v2", titulo: "Clipe da caminhada", formato: "short", portaVoz: "Busnelo", tint: "linear-gradient(135deg,#3a3a42,#12121a)" },
    { id: "v3", titulo: "Entrevista na rádio", formato: "longo", portaVoz: "Marcia Lima", tint: "linear-gradient(135deg,#c79c12,#5a4708)" },
    { id: "v4", titulo: "Bastidores do evento", formato: "short", portaVoz: "Busnelo", tint: "linear-gradient(135deg,#2a2a32,#0e0e12)" },
    { id: "v5", titulo: "Depoimento da feira", formato: "longo", portaVoz: "Marcia Lima", tint: "linear-gradient(135deg,#f3dc9a,#c79c12)" },
    { id: "v6", titulo: "Corte sobre saúde", formato: "short", portaVoz: "Marcia Lima", tint: "linear-gradient(135deg,#1c1c22,#f4ce1f)" },
  ],
  historico: [
    { id: "h1", titulo: "Resposta sobre segurança", portaVoz: "Busnelo", data: "20 jul 2026", resultado: "aprovada" },
    { id: "h2", titulo: "Clipe da caminhada", portaVoz: "Busnelo", data: "16 jul 2026", resultado: "aprovada" },
    { id: "h3", titulo: "Entrevista na rádio", portaVoz: "Marcia Lima", data: "11 jul 2026", resultado: "reedicao" },
    { id: "h4", titulo: "Bastidores do evento", portaVoz: "Busnelo", data: "9 jul 2026", resultado: "aprovada" },
  ],
  conquistas: [
    { icone: "⚡", nome: "Entrega relâmpago" },
    { icone: "🎯", nome: "10 aprovadas seguidas" },
    { icone: "🔥", nome: "Sequência de 5 dias" },
  ],
};

export type Desafio = {
  id: string;
  titulo: string;
  descricao: string;
  xp: number;
  dificuldade: 1 | 2 | 3;
  cumprido: boolean;
};

// desafios de engajamento do dia — NÃO confundir com "Missão" (que é a pauta/trabalho em si)
export const DESAFIOS_HOJE: Desafio[] = [
  {
    id: "d1",
    titulo: "Entregue uma missão hoje",
    descricao: "Termine e entregue qualquer pauta que você já reservou.",
    xp: 40,
    dificuldade: 2,
    cumprido: false,
  },
  {
    id: "d2",
    titulo: "Mantenha a sequência",
    descricao: "Acesse a Oficina Amarela hoje pra não perder o streak.",
    xp: 10,
    dificuldade: 1,
    cumprido: true,
  },
  {
    id: "d3",
    titulo: "Suba no ranking",
    descricao: "Entregue com qualidade — cada aprovação soma XP.",
    xp: 25,
    dificuldade: 2,
    cumprido: false,
  },
];

export type EditorRanking = {
  apelido: string;
  nivel: Nivel;
  reputacao: number;
  entregues: number;
  streak: number;
};

// O ranking fake que existia aqui saiu: /ranking agora lê os editores reais
// do banco (rankingEditores, em lib/perfil-db.ts). O tipo continua porque é
// o formato que aquela consulta devolve.
