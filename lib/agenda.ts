import type { Formato, Pauta } from "@/lib/pautas";

export type Trabalho = {
  id: string;
  titulo: string;
  portaVoz: string;
  formato: Formato;
  reservadaHaHoras: number; // há quantas horas o editor pegou (demo)
  prazoTotalHoras: number; // tempo total dado até a entrega
  etapa: string;
};

/** O que o editor tem na mesa AGORA — datas absolutas, vindas do banco. */
export type TrabalhoEmMaos = {
  id: string;
  titulo: string;
  portaVoz: string;
  formato: Formato;
  inicioIso: string;
  prazoIso: string;
  etapa: string;
  // brief criativo + acesso — o editor precisa disso sem voltar pra fila
  tom?: string;
  cor?: string;
  fonte?: string;
  refs?: string;
  driveLink?: string;
  prazoDesejado?: string;
};

const PRAZO_HORAS = 24;

const ETAPA_POR_STATUS: Record<string, string> = {
  reservada: "Com você",
  minha: "Com você",
  em_revisao: "Na conferência",
  reedicao: "Ajuste pedido",
};

/**
 * Converte a missão reservada (banco) no formato que a "Mesa agora" desenha.
 *
 * O início vem de `reservadaAte - 24h` porque é assim que `reservarPauta`
 * grava o prazo — não existe coluna separada de "reservada em".
 */
export function trabalhoDaPauta(p: Pauta | null): TrabalhoEmMaos[] {
  if (!p?.reservadaAte) return [];
  const prazo = new Date(p.reservadaAte).getTime();
  return [
    {
      id: p.id,
      titulo: p.titulo,
      portaVoz: p.portaVoz,
      formato: p.formato,
      inicioIso: new Date(prazo - PRAZO_HORAS * 3_600_000).toISOString(),
      prazoIso: p.reservadaAte,
      etapa: ETAPA_POR_STATUS[p.status] ?? "Com você",
      tom: p.brief.tom,
      cor: p.brief.cor,
      fonte: p.brief.fonte,
      refs: p.brief.refs,
      driveLink: p.driveLink,
      prazoDesejado: p.prazoDesejado,
    },
  ];
}

// A barra de progresso = % do PRAZO já decorrido (tempo), não trabalho manual.
// Ex.: pegou segunda, entrega quarta (48h). Na terça (24h depois) = 50%.
export const TRABALHOS: Trabalho[] = [
  {
    id: "t1",
    titulo: "Resposta sobre segurança",
    portaVoz: "Busnelo",
    formato: "short",
    reservadaHaHoras: 18,
    prazoTotalHoras: 24, // faltam ~6h · 75% do prazo
    etapa: "Cortando",
  },
  {
    id: "t2",
    titulo: "Entrevista na rádio",
    portaVoz: "Marcia Lima",
    formato: "longo",
    reservadaHaHoras: 28,
    prazoTotalHoras: 48, // faltam ~20h · 58% do prazo
    etapa: "Assistindo o bruto",
  },
];

export const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const PERIODOS = ["Manhã", "Tarde", "Noite"];

// [periodo][dia] — true = livre pra pegar pauta
export const DISPONIBILIDADE_PADRAO: boolean[][] = [
  [false, true, false, true, false, false, false],
  [true, true, true, true, true, false, false],
  [true, false, true, false, true, true, false],
];
