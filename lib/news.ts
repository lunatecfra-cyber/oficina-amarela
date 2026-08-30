export type NewsArticle = {
  date: string;
  title: string;
  text: string;
  // aliases
  data?: string;
  titulo?: string;
  texto?: string;
};

export type Novidade = NewsArticle;

export const NEWS_ARTICLES: NewsArticle[] = [
  {
    date: "2026-08-15",
    title: "Avisos por e-mail",
    text: "Agora você recebe e-mail quando um editor pega sua missão, quando o vídeo fica pronto, quando aprovam sua entrega e quando pedem um ajuste. Antes só dava pra saber abrindo o site.",
    data: "2026-08-15",
    titulo: "Avisos por e-mail",
    texto:
      "Agora você recebe e-mail quando um editor pega sua missão, quando o vídeo fica pronto, quando aprovam sua entrega e quando pedem um ajuste. Antes só dava pra saber abrindo o site.",
  },
  {
    date: "2026-08-15",
    title: "Quem pediu o vídeo também aprova",
    text: "O porta-voz não precisa mais esperar o controle de qualidade: assiste, dá a nota e fecha a missão na hora. O inspetor continua podendo aprovar quando for preciso.",
    data: "2026-08-15",
    titulo: "Quem pediu o vídeo também aprova",
    texto:
      "O porta-voz não precisa mais esperar o controle de qualidade: assiste, dá a nota e fecha a missão na hora. O inspetor continua podendo aprovar quando for preciso.",
  },
  {
    date: "2026-08-14",
    title: "Conversa dentro da missão",
    text: "Porta-voz, editor e inspetor conversam na própria missão — sem sair pro WhatsApp e sem perder o contexto do que foi combinado.",
    data: "2026-08-14",
    titulo: "Conversa dentro da missão",
    texto:
      "Porta-voz, editor e inspetor conversam na própria missão — sem sair pro WhatsApp e sem perder o contexto do que foi combinado.",
  },
  {
    date: "2026-08-13",
    title: "Entrar com o Google",
    text: "Dá pra criar conta e entrar direto pela conta Google. Quem esqueceu a senha também volta por aí, sem depender de e-mail de recuperação.",
    data: "2026-08-13",
    titulo: "Entrar com o Google",
    texto:
      "Dá pra criar conta e entrar direto pela conta Google. Quem esqueceu a senha também volta por aí, sem depender de e-mail de recuperação.",
  },
  {
    date: "2026-08-12",
    title: "A fila que chama você",
    text: "As missões chegam uma por vez pra quem está online, em vez de uma lista onde todo mundo disputa. Aceitou, é sua; passou, vai pro próximo.",
    data: "2026-08-12",
    titulo: "A fila que chama você",
    texto:
      "As missões chegam uma por vez pra quem está online, em vez de uma lista onde todo mundo disputa. Aceitou, é sua; passou, vai pro próximo.",
  },
];

export const NOVIDADES = NEWS_ARTICLES;

export function shortDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  const months = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  return `${day} ${months[month - 1]}`;
}

export const dataCurta = shortDate;
