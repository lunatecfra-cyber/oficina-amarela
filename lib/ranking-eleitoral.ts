export const FIM_CICLO_ELEITORAL = new Date("2026-10-26T02:59:59.999Z");

export type PremioEleitoral =
  | "ingresso_top1"
  | "bandeira_top2"
  | "caneca_top3"
  | "sorteio_constancia";

export function calcularMetaSemanal(diasNoCiclo: number): 1 | 2 {
  return diasNoCiclo <= 4 ? 1 : 2;
}

export function calcularPremios(editoresAtivos: number): PremioEleitoral[] {
  const premios: PremioEleitoral[] = [];
  if (editoresAtivos >= 10) premios.push("ingresso_top1");
  if (editoresAtivos >= 20) premios.push("bandeira_top2");
  if (editoresAtivos >= 30) premios.push("caneca_top3");
  if (editoresAtivos >= 50) premios.push("sorteio_constancia");
  return premios;
}

/**
 * Só apresentação: o rótulo e o marco de cada prêmio, na ordem em que são
 * liberados. Quem decide o que está liberado continua sendo `calcularPremios`
 * — daqui sai apenas o texto da tela. O teste `marcos da vitrine batem com
 * calcularPremios` trava os dois juntos, pra tela nunca prometer um número
 * diferente do que o código libera.
 */
export const PREMIOS_ELEITORAIS = [
  { chave: "ingresso_top1", ativos: 10, premio: "Ingresso", quem: "Top 1", segredo: false },
  { chave: "bandeira_top2", ativos: 20, premio: "Bandeira", quem: "Top 2", segredo: true },
  { chave: "caneca_top3", ativos: 30, premio: "Caneca", quem: "Top 3", segredo: true },
  { chave: "sorteio_constancia", ativos: 50, premio: "Sorteio", quem: "Por constância", segredo: false },
] as const satisfies ReadonlyArray<{
  chave: PremioEleitoral;
  ativos: number;
  premio: string;
  quem: string;
  /** `true` esconde o nome do prêmio até a guilda destravar o marco — o
   *  2º e o 3º lugar são presentes misteriosos, como já diz a premiação do
   *  festival na página inicial. O marco em si nunca é segredo: sem ele
   *  ninguém sabe o que perseguir. */
  segredo: boolean;
}>;

export function calcularConstancia(cumpriuSemanas: boolean[], bloqueiosDisponiveis: number) {
  let sequencia = 0;
  let maiorSequencia = 0;
  let bloqueiosConsumidos = 0;

  for (const cumpriu of cumpriuSemanas) {
    if (cumpriu) {
      sequencia += 1;
    } else if (bloqueiosConsumidos < bloqueiosDisponiveis) {
      bloqueiosConsumidos += 1;
      sequencia += 1;
    } else {
      sequencia = 0;
    }
    maiorSequencia = Math.max(maiorSequencia, sequencia);
  }

  return { sequencia, bloqueiosConsumidos, elegivelAoSorteio: maiorSequencia >= 4 };
}

export function indicacaoPodePremiar(
  videosAprovados: number,
  recompensasNoMes: number,
  jaPremiada: boolean,
): boolean {
  return videosAprovados >= 2 && recompensasNoMes < 5 && !jaPremiada;
}

export type ItemRanking = {
  editorId: number;
  quantidade: number;
  atingiuQuantidadeEm: Date;
};

export function ordenarRanking<T extends ItemRanking>(itens: T[]): T[] {
  return [...itens].sort(
    (a, b) =>
      b.quantidade - a.quantidade ||
      a.atingiuQuantidadeEm.getTime() - b.atingiuQuantidadeEm.getTime() ||
      a.editorId - b.editorId,
  );
}

type ConviteConsultado = {
  email: string;
  expiraEm: Date;
  usadoEm: Date | null;
  revogadoEm: Date | null;
};

export function convitePodeSerUsado(
  convite: ConviteConsultado,
  email: string,
  agora = new Date(),
): boolean {
  return (
    convite.email.trim().toLowerCase() === email.trim().toLowerCase() &&
    convite.expiraEm.getTime() > agora.getTime() &&
    convite.usadoEm === null &&
    convite.revogadoEm === null
  );
}
