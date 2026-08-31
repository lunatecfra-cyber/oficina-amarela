export type MissionStatus =
  | "available"
  | "offered"
  | "mine"
  | "reserved"
  | "in_review"
  | "revision_requested"
  | "reedit"
  | "approved"
  | "completed"
  | "finished"
  | "disponivel"
  | "oferecida"
  | "ofertada"
  | "minha"
  | "reservada"
  | "em_revisao"
  | "reedicao"
  | "aprovada"
  | "finalizada";

export type StatusPauta = MissionStatus;

export type VideoFormat = "short" | "long" | "longo";
export type Formato = VideoFormat;
export type Format = VideoFormat;

export type Mission = {
  id: string;
  spokesperson: string;
  spokespersonHandle?: string;
  title: string;
  format: VideoFormat;
  brief: {
    tone?: string;
    color?: string;
    font?: string;
    refs?: string;
    tom?: string;
    cor?: string;
    fonte?: string;
  };
  status: MissionStatus;
  createdAt: string;
  reservedAt?: string;
  reservedBy?: string;
  driveLink?: string;
  youtubeLink?: string;
  deliveryLink?: string;
  inspectorNotes?: string;
  extras?: string;
  motivation?: string;
  reason?: string;
  desiredDeadline?: string;
  rawVideoUrl?: string;
  deliveryVideoUrl?: string;
  watermark?: string;
  campaignTaxId?: string;
  candidateNumber?: string;
  voterId?: string;
  revisionRequestedBy?: "inspector" | "spokesperson" | "inspetor" | "porta_voz";
  reeditRequestedBy?: "inspector" | "spokesperson" | "inspetor" | "porta_voz";
  // compatibility aliases
  portaVoz?: string;
  portaVozApelido?: string;
  titulo?: string;
  formato?: VideoFormat;
  criadaEm?: string;
  reservadaEm?: string;
  reservadaPor?: string;
  entregaLink?: string;
  notasInspetor?: string;
  motivo?: string;
  prazoDesejado?: string;
  videoBrutoUrl?: string;
  videoEntregaUrl?: string;
  marcaDagua?: string;
  cnpjCampanha?: string;
  numeroEleitoral?: string;
  tituloEleitor?: string;
  reedicaoPedidaPor?: "inspector" | "spokesperson" | "inspetor" | "porta_voz";
};

export type Pauta = Mission;

export type Editor = {
  handle: string;
  tier?: "Apprentice" | "Journeyman" | "Craftsman" | "Master Artisan";
  level?: string;
  deliveredCount: number;
  rating: number | null;
  apelido?: string;
  nivel?: string;
  entregues?: number;
  nota?: number | null;
};

export const CURRENT_EDITOR: Editor = {
  handle: "jr.eneias",
  tier: "Journeyman",
  level: "Oficial",
  deliveredCount: 12,
  rating: 4.8,
  apelido: "jr.eneias",
  nivel: "Oficial",
  entregues: 12,
  nota: 4.8,
};

export const EDITOR_ATUAL = CURRENT_EDITOR;

export const CURRENT_INSPECTOR = {
  handle: "coronel.reis",
  apelido: "coronel.reis",
};

export const INSPETOR_ATUAL = CURRENT_INSPECTOR;

export const DEMO_MISSIONS: Mission[] = [
  {
    id: "p1",
    spokesperson: "Busnelo",
    title: "Corte sobre segurança do bairro",
    format: "short",
    brief: { tone: "Direto e firme", color: "Quente", font: "Sem serifa pesada" },
    status: "available",
    createdAt: "2026-07-23T09:00:00Z",
    portaVoz: "Busnelo",
    titulo: "Corte sobre segurança do bairro",
    formato: "short",
    criadaEm: "2026-07-23T09:00:00Z",
  },
  {
    id: "p2",
    spokesperson: "Busnelo",
    title: "Entrevista completa na rádio",
    format: "long",
    brief: { tone: "Institucional", color: "Sóbria", font: "Clássica" },
    status: "available",
    createdAt: "2026-07-23T10:30:00Z",
    portaVoz: "Busnelo",
    titulo: "Entrevista completa na rádio",
    formato: "longo",
    criadaEm: "2026-07-23T10:30:00Z",
  },
  {
    id: "p3",
    spokesperson: "Valeska",
    title: "Bastidores da feira livre",
    format: "short",
    brief: { tone: "Espontâneo", color: "Vibrante", font: "Moderna" },
    status: "available",
    createdAt: "2026-07-23T11:15:00Z",
    portaVoz: "Valeska",
    titulo: "Bastidores da feira livre",
    formato: "short",
    criadaEm: "2026-07-23T11:15:00Z",
  },
  {
    id: "p4",
    spokesperson: "Valeska",
    title: "Discurso de lançamento",
    format: "long",
    brief: { tone: "Enérgico", color: "Contraste alto", font: "Sem serifa" },
    status: "reserved",
    createdAt: "2026-07-22T14:00:00Z",
    portaVoz: "Valeska",
    titulo: "Discurso de lançamento",
    formato: "longo",
    criadaEm: "2026-07-22T14:00:00Z",
  },
  {
    id: "p5",
    spokesperson: "Busnelo",
    title: "Resposta sobre transporte",
    format: "short",
    brief: { tone: "Calmo e técnico", color: "Fria", font: "Clean" },
    status: "in_review",
    createdAt: "2026-07-22T16:45:00Z",
    portaVoz: "Busnelo",
    titulo: "Resposta sobre transporte",
    formato: "short",
    criadaEm: "2026-07-22T16:45:00Z",
  },
  {
    id: "p6",
    spokesperson: "Valeska",
    title: "Caminhada na zona norte",
    format: "short",
    brief: { tone: "Acolhedor", color: "Natural", font: "Dinâmica" },
    status: "reedit",
    createdAt: "2026-07-21T08:00:00Z",
    portaVoz: "Valeska",
    titulo: "Caminhada na zona norte",
    formato: "short",
    criadaEm: "2026-07-21T08:00:00Z",
  },
  {
    id: "p7",
    spokesperson: "Busnelo",
    title: "Prestação de contas do mandato",
    format: "long",
    brief: { tone: "Transparente", color: "Equilibrada", font: "Institucional" },
    status: "approved",
    createdAt: "2026-07-20T10:00:00Z",
    portaVoz: "Busnelo",
    titulo: "Prestação de contas do mandato",
    formato: "longo",
    criadaEm: "2026-07-20T10:00:00Z",
  },
  {
    id: "p8",
    spokesperson: "Valeska",
    title: "Depoimento de apoiadores",
    format: "short",
    brief: { tone: "Emocionante", color: "Quente suave", font: "Humana" },
    status: "completed",
    createdAt: "2026-07-19T13:30:00Z",
    portaVoz: "Valeska",
    titulo: "Depoimento de apoiadores",
    formato: "short",
    criadaEm: "2026-07-19T13:30:00Z",
  },
];

export const PAUTAS = DEMO_MISSIONS;
export const MISSIONS = DEMO_MISSIONS;

export const STATUS_LABEL: Record<string, string> = {
  available: "na fila",
  disponivel: "na fila",
  offered: "oferecida",
  oferecida: "oferecida",
  ofertada: "oferecida",
  mine: "comigo",
  minha: "comigo",
  reserved: "comigo",
  reservada: "comigo",
  in_review: "em revisão",
  em_revisao: "em revisão",
  revision_requested: "reedição pedida",
  reedit: "reedição pedida",
  reedicao: "reedição pedida",
  approved: "aprovada",
  aprovada: "aprovada",
  completed: "finalizada",
  finished: "finalizada",
  finalizada: "finalizada",
};

export const ROTULO_STATUS = STATUS_LABEL;
export const STATUS_LABELS = STATUS_LABEL;

export const FORMAT_LABEL: Record<string, string> = {
  short: "Vídeo curto (9:16 · até 90s)",
  long: "Vídeo longo (16:9 · no YouTube)",
  longo: "Vídeo longo (16:9 · no YouTube)",
};

export const ROTULO_FORMATO = FORMAT_LABEL;
export const FORMAT_LABELS = FORMAT_LABEL;

export function spokespersonStatusMessage(status: string): {
  text: string;
  color: string;
  texto: string;
  cor: string;
} {
  switch (status) {
    case "offered":
    case "oferecida":
    case "ofertada":
      return {
        text: "📨 Oferecida para um editor",
        color: "text-gold-hi",
        texto: "📨 Oferecida para um editor",
        cor: "text-gold-hi",
      };
    case "reserved":
    case "reservada":
    case "mine":
    case "minha":
      return {
        text: "🎬 Edição iniciada",
        color: "text-gold-hi",
        texto: "🎬 Edição iniciada",
        cor: "text-gold-hi",
      };
    case "in_review":
    case "em_revisao":
      return {
        text: "🎬 Vídeo entregue — controle de qualidade avaliando",
        color: "text-gold-hi",
        texto: "🎬 Vídeo entregue — controle de qualidade avaliando",
        cor: "text-gold-hi",
      };
    case "revision_requested":
    case "reedit":
    case "reedicao":
      return {
        text: "💬 Devolvida ao editor com observações",
        color: "text-silver-hi",
        texto: "💬 Devolvida ao editor com observações",
        cor: "text-silver-hi",
      };
    case "approved":
    case "aprovada":
      return {
        text: "🔍 Pronta — assista e dê seu aceite",
        color: "text-gold-hi",
        texto: "🔍 Pronta — assista e dê seu aceite",
        cor: "text-gold-hi",
      };
    case "completed":
    case "finished":
    case "finalizada":
      return {
        text: "✅ Aprovada! Pronta para postar",
        color: "text-ok",
        texto: "✅ Aprovada! Pronta para postar",
        cor: "text-ok",
      };
    default:
      return {
        text: "Na fila de edição",
        color: "text-muted",
        texto: "Na fila de edição",
        cor: "text-muted",
      };
  }
}

export const mensagemStatusPortaVoz = spokespersonStatusMessage;

export const MISSION_STAGES = [
  "Criada",
  "Na fila",
  "Com editor",
  "Em revisão",
  "Pronta",
  "Finalizada",
] as const;

export const ETAPAS_MISSAO = MISSION_STAGES;

export function currentStage(status: string): number {
  switch (status) {
    case "available":
    case "disponivel":
    case "offered":
    case "oferecida":
    case "ofertada":
      return 1;
    case "reserved":
    case "reservada":
    case "mine":
    case "minha":
    case "revision_requested":
    case "reedit":
    case "reedicao":
      return 2;
    case "in_review":
    case "em_revisao":
      return 3;
    case "approved":
    case "aprovada":
      return 4;
    case "completed":
    case "finished":
    case "finalizada":
      return 5;
    default:
      return 0;
  }
}

export const etapaAtual = currentStage;

/**
 * Os quatro grupos que o porta-voz vê no resumo da tela inicial.
 *
 * É agrupamento de APRESENTAÇÃO — não muda status nem regra. Repare que
 * `approved` cai em "em revisão", e não em "concluída": nesse ponto o vídeo
 * passou pelo controle de qualidade mas ainda espera o aceite do porta-voz.
 * Só `finished` é trabalho encerrado.
 */
export type SpokespersonBucket = "waiting_editor" | "editing" | "reviewing" | "done";

export const SPOKESPERSON_BUCKET_LABEL: Record<SpokespersonBucket, string> = {
  waiting_editor: "Aguardando editor",
  editing: "Em edição",
  reviewing: "Em revisão",
  done: "Concluídas",
};

export function spokespersonBucket(status: string): SpokespersonBucket {
  switch (status) {
    case "available":
    case "disponivel":
    case "offered":
    case "oferecida":
    case "ofertada":
      return "waiting_editor";
    case "reserved":
    case "reservada":
    case "mine":
    case "minha":
    case "revision_requested":
    case "reedit":
    case "reedicao":
      return "editing";
    case "in_review":
    case "em_revisao":
    case "approved":
    case "aprovada":
      return "reviewing";
    case "completed":
    case "finished":
    case "finalizada":
      return "done";
    default:
      return "waiting_editor";
  }
}

/** A missão está parada esperando uma ação do porta-voz? */
export function waitingOnSpokesperson(status: string): boolean {
  return status === "approved" || status === "aprovada";
}
