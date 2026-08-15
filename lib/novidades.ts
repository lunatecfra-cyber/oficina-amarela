/**
 * As novidades que aparecem na página de entrada.
 *
 * Ficam num arquivo, e não no banco, porque quem escreve é você — não os
 * usuários. Banco exigiria uma tela de admin pra manter, e a tela seria mais
 * trabalho que o conteúdo. Pra publicar uma novidade: adiciona no topo da lista
 * e sobe. A página lê daqui.
 *
 * A data é escrita à mão, no formato "AAAA-MM-DD", e formatada na tela. Só as
 * primeiras aparecem na entrada — o resto fica pra quem clicar em ver todas.
 */
export type Novidade = {
  /** "AAAA-MM-DD" */
  data: string;
  titulo: string;
  /** uma frase que explique o que muda pra quem usa, não o que mudou no código */
  texto: string;
};

export const NOVIDADES: Novidade[] = [
  {
    data: "2026-08-15",
    titulo: "Avisos por e-mail",
    texto:
      "Agora você recebe e-mail quando um editor pega sua missão, quando o vídeo fica pronto, quando aprovam sua entrega e quando pedem um ajuste. Antes só dava pra saber abrindo o site.",
  },
  {
    data: "2026-08-15",
    titulo: "Quem pediu o vídeo também aprova",
    texto:
      "O candidato não precisa mais esperar o controle de qualidade: assiste, dá a nota e fecha a missão na hora. O inspetor continua podendo aprovar quando for preciso.",
  },
  {
    data: "2026-08-14",
    titulo: "Conversa dentro da missão",
    texto:
      "Candidato, editor e inspetor conversam na própria missão — sem sair pro WhatsApp e sem perder o contexto do que foi combinado.",
  },
  {
    data: "2026-08-13",
    titulo: "Entrar com o Google",
    texto:
      "Dá pra criar conta e entrar direto pela conta Google. Quem esqueceu a senha também volta por aí, sem depender de e-mail de recuperação.",
  },
  {
    data: "2026-08-12",
    titulo: "A fila que chama você",
    texto:
      "As missões chegam uma por vez pra quem está online, em vez de uma lista onde todo mundo disputa. Aceitou, é sua; passou, vai pro próximo.",
  },
];

/** "2026-08-15" → "15 ago". Sem ano: a lista é curta e recente. */
export function dataCurta(iso: string): string {
  const [, mes, dia] = iso.split("-").map(Number);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${dia} ${meses[mes - 1]}`;
}
