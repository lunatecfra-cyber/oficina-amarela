export type StatusPauta =
  | "disponivel"
  // oferecida a um editor específico, com prazo pra responder (dispatch).
  // Sai da lista aberta enquanto a oferta está de pé.
  | "oferecida"
  | "minha"
  | "reservada"
  | "em_revisao"
  | "reedicao"
  // 'aprovada' = o inspetor liberou, mas ainda espera o porta-voz conferir.
  // 'finalizada' = o porta-voz aceitou. É o único estado terminal.
  | "aprovada"
  | "finalizada";

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
  // prazo de entrega REMOVIDO do produto: vencia sem devolver a missão pra
  // fila e o vídeo "se perdia" com um editor sumido. Mantido no tipo só
  // porque missões antigas podem carregar o valor — telas novas ignoram.
  reservadaAte?: string;
  // quando o editor pegou a missão (sem prazo: é dela até entregar/devolver)
  reservadaEm?: string;
  reservadaPor?: string;
  driveLink?: string;
  entregaLink?: string;
  notasInspetor?: string;
  // campos do brief que antes eram perdidos no POST — agora persistidos
  extras?: string; // cortes/trechos específicos (passo 2 do wizard)
  motivo?: string; // contexto/porquê do vídeo (passo 4)
  prazoDesejado?: string; // ISO date (passo 5)
  // quem mandou de volta pra reedição — muda o texto que o editor lê
  reedicaoPedidaPor?: "inspetor" | "porta_voz";
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
  oferecida: "Oferecida a um editor",
  minha: "Sua missão",
  reservada: "Reservada",
  em_revisao: "Em revisão",
  reedicao: "Reedição pedida",
  aprovada: "Pronta pra conferir",
  finalizada: "Concluída",
};

export const ROTULO_FORMATO: Record<Formato, string> = {
  short: "Short 9:16",
  longo: "Longo 16:9",
};

/**
 * O mesmo status, dito do ponto de vista de quem está esperando o vídeo.
 * Vive aqui porque o painel e a tela de detalhe mostram a mesma frase — antes
 * cada um tinha a sua cópia, e elas já tinham começado a divergir.
 */
export function mensagemStatusPortaVoz(status: StatusPauta): {
  texto: string;
  cor: string;
} {
  switch (status) {
    case "oferecida":
      return { texto: "📨 Oferecida a um editor", cor: "text-gold-hi" };
    case "reservada":
    case "minha":
      return { texto: "🎬 Seu vídeo começou a ser feito", cor: "text-gold-hi" };
    // Dizia só "Na conferência de qualidade". Verdade, mas escondia a notícia
    // que interessa a quem está esperando: o vídeo ficou pronto. Do jeito
    // antigo lia-se como "ainda não é com você", e a pessoa saía da tela sem
    // saber que já dava pra assistir.
    case "em_revisao":
      return { texto: "🎬 Vídeo entregue — conferindo a qualidade", cor: "text-gold-hi" };
    case "reedicao":
      return { texto: "💬 Voltou pro editor com um ajuste", cor: "text-silver-hi" };
    case "aprovada":
      return { texto: "🔍 Pronto — confira e libere", cor: "text-gold-hi" };
    case "finalizada":
      return { texto: "✅ Aceito! Pode postar", cor: "text-ok" };
    default:
      return { texto: "Na fila dos editores", cor: "text-muted" };
  }
}

/**
 * As etapas do ciclo, em ordem, pra desenhar a linha do tempo. `reedicao` não
 * é etapa própria: é um retorno pra "com o editor", então cai no índice 2.
 */
export const ETAPAS_MISSAO = [
  "Criada",
  "Na fila",
  "Com o editor",
  "Na conferência",
  "Pronta",
  "Concluída",
] as const;

export function etapaAtual(status: StatusPauta): number {
  switch (status) {
    case "disponivel":
    // oferecida ainda é "na fila" do ponto de vista de quem espera: nenhum
    // editor assumiu o trabalho até aceitar
    case "oferecida":
      return 1;
    case "reservada":
    case "minha":
    case "reedicao":
      return 2;
    case "em_revisao":
      return 3;
    case "aprovada":
      return 4;
    case "finalizada":
      return 5;
    default:
      return 0;
  }
}
