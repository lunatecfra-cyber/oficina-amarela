import type { Formato, Pauta } from "@/lib/pautas";

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

/**
 * Onde estamos na grade AGORA: [periodo, dia], nos mesmos índices de
 * PERIODOS e DIAS.
 *
 * A grade começa na segunda, mas getDay() começa no domingo — daí o
 * deslocamento. Madrugada (0h–5h) cai em "Noite" porque a grade não tem
 * faixa própria pra ela, e quem marcou noite é justamente quem vira a noite.
 *
 * O dispatch faz esta MESMA conta em SQL (lib/fila-db.ts), fixada no fuso de
 * São Paulo. Aqui usamos a hora local do navegador, que é só pra destacar a
 * célula na tela.
 */
export function blocoAtual(d = new Date()): { periodo: number; dia: number } {
  const dia = (d.getDay() + 6) % 7;
  const h = d.getHours();
  const periodo = h >= 6 && h < 12 ? 0 : h >= 12 && h < 18 ? 1 : 2;
  return { periodo, dia };
}

export const DIAS =["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
export const PERIODOS = ["Manhã", "Tarde", "Noite"];

// [periodo][dia] — true = livre pra pegar pauta
export const DISPONIBILIDADE_PADRAO: boolean[][] = [
  [false, true, false, true, false, false, false],
  [true, true, true, true, true, false, false],
  [true, false, true, false, true, true, false],
];
