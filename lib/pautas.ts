export type StatusPauta =
  | "disponivel"
  | "minha"
  | "reservada"
  | "em_revisao"
  | "reedicao"
  | "aprovada";

export type Formato = "short" | "longo";

export type Pauta = {
  id: string;
  portaVoz: string;
  // só existe pra pauta real (vinda do banco) — usado pra buscar o perfil
  // de verdade do porta-voz em vez de casar por nome (que pode repetir)
  portaVozApelido?: string;
  titulo: string;
  formato: Formato;
  brief: {
    tom?: string;
    cor?: string;
    fonte?: string;
    refs?: string;
  };
  status: StatusPauta;
  criadaEm: string;
  reservadaAte?: string;
  reservadaPor?: string;
  driveLink?: string;
  entregaLink?: string;
  notasInspetor?: string;
  // campos do brief que antes eram perdidos no POST — agora persistidos
  extras?: string; // cortes/trechos específicos (passo 2 do wizard)
  motivo?: string; // contexto/porquê do vídeo (passo 4)
  prazoDesejado?: string; // ISO date (passo 5)
};

export type Editor = {
  apelido: string;
  nivel: "Aprendiz" | "Oficial" | "Artífice" | "Mestre-Artesão";
  entregues: number;
  nota: number | null;
};

export const EDITOR_ATUAL: Editor = {
  apelido: "jr.eneias",
  nivel: "Oficial",
  entregues: 12,
  nota: 4.8, // mesmo valor de PERFIL_EDITOR.nota (lib/perfil.ts) - mesma pessoa, dado fake consistente
};

export const INSPETOR_ATUAL = {
  apelido: "coronel.reis",
};

export const PAUTAS: Pauta[] = [
  {
    id: "p1",
    portaVoz: "Busnelo",
    titulo: "Corte sobre segurança no bairro",
    formato: "short",
    brief: { tom: "Direto e firme", cor: "Quente", fonte: "Bold condensada" },
    status: "disponivel",
    criadaEm: "2026-07-23T09:00:00Z",
  },
  {
    id: "p2",
    portaVoz: "Busnelo",
    titulo: "Entrevista completa na rádio",
    formato: "longo",
    brief: { tom: "Sóbrio", cor: "Neutra", refs: "Estilo podcast" },
    status: "disponivel",
    criadaEm: "2026-07-23T07:30:00Z",
  },
  {
    id: "p3",
    portaVoz: "Marcia Lima",
    titulo: "Resposta rápida sobre saúde",
    formato: "short",
    brief: { tom: "Empático", cor: "Fria", fonte: "Sans limpa" },
    status: "disponivel",
    criadaEm: "2026-07-22T18:10:00Z",
  },
  {
    id: "p4",
    portaVoz: "Busnelo",
    titulo: "Bastidores da caminhada",
    formato: "short",
    brief: { tom: "Leve", cor: "Quente" },
    status: "reservada",
    reservadaPor: "duda.corte",
    criadaEm: "2026-07-22T14:00:00Z",
  },
  {
    id: "p5",
    portaVoz: "Marcia Lima",
    titulo: "Depoimento da feira",
    formato: "longo",
    brief: { tom: "Documental", cor: "Neutra" },
    status: "em_revisao",
    criadaEm: "2026-07-21T11:00:00Z",
    reservadaPor: "duda.corte",
    entregaLink: "https://drive.google.com/file/d/EXEMPLO-EDITADO-1/view",
  },
  {
    id: "p6",
    portaVoz: "Busnelo",
    titulo: "Resumo da agenda da semana",
    formato: "short",
    brief: { tom: "Ágil", cor: "Quente", fonte: "Bold condensada" },
    status: "em_revisao",
    criadaEm: "2026-07-20T16:40:00Z",
    reservadaPor: "jr.eneias",
    entregaLink: "https://drive.google.com/file/d/EXEMPLO-EDITADO-2/view",
  },
];

export const ROTULO_STATUS: Record<StatusPauta, string> = {
  disponivel: "Disponível",
  minha: "Sua missão",
  reservada: "Reservada",
  em_revisao: "Em revisão",
  reedicao: "Reedição pedida",
  aprovada: "Aprovada",
};

export const ROTULO_FORMATO: Record<Formato, string> = {
  short: "Short 9:16",
  longo: "Longo 16:9",
};
