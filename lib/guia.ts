/**
 * Os roteiros do "Como usar" — um por tela, não um tour gigante que atravessa
 * o sistema inteiro.
 *
 * A razão é prática: um tour que troca de rota tem que esperar a página
 * carregar, torcer pro elemento existir e lidar com quem clica no meio do
 * caminho. Aqui cada tela ensina a própria tela. É o que a pessoa está
 * olhando na hora, e é onde a dúvida aparece.
 *
 * Cada passo aponta pra um `data-guia="..."` que existe no JSX daquela tela.
 * Passo cujo alvo não está na tela naquele momento (a fila vazia não tem
 * cartão de missão) é simplesmente pulado — ver `passosVisiveis` no
 * componente.
 */

export type Demo = "drive" | "entrega";

export type PassoGuia = {
  /** valor do data-guia no elemento que o balão aponta */
  alvo: string;
  titulo: string;
  texto: string;
  /** animaçãozinha dentro do balão, quando o passo pede demonstração */
  demo?: Demo;
};

export type Roteiro = {
  chave: string;
  /** sobe quando o roteiro muda de verdade: quem já viu volta a ver */
  versao: number;
  titulo: string;
  passos: PassoGuia[];
};

const ROTEIROS: readonly (Roteiro & { casa: (rota: string) => boolean })[] = [
  {
    chave: "porta-voz",
    versao: 1,
    titulo: "Suas missões",
    casa: (r) => r === "/porta-voz",
    passos: [
      {
        alvo: "nova-missao",
        titulo: "Tudo começa aqui",
        texto:
          "Você grava no celular, joga na sua pasta do Drive e descreve o que quer. Quem edita vem depois.",
      },
      {
        alvo: "cartao-missao",
        titulo: "O cartão conta o que está acontecendo",
        texto:
          "Na fila, com o editor, ou pronto pra assistir. Quando o vídeo chega, o cartão avisa em dourado — é só tocar.",
      },
    ],
  },
  {
    chave: "nova-pauta",
    versao: 1,
    titulo: "Criar uma missão",
    casa: (r) => r === "/porta-voz/nova-pauta",
    passos: [
      {
        alvo: "campo-drive",
        titulo: "O link do Drive",
        // o texto é curto de propósito: quem ensina o passo a passo é a
        // animação logo abaixo. Repetir em palavras só empurrava o balão
        // pra fora da tela no celular.
        texto: "O vídeo bruto nunca sai do seu Drive — a gente só passa o link.",
        demo: "drive",
      },
      {
        alvo: "passos-briefing",
        titulo: "O resto é o seu pedido",
        texto:
          "Tom, cor, legenda, cortes e o porquê do vídeo. Quanto mais claro aqui, menos ida e volta depois.",
      },
    ],
  },
  {
    chave: "missao-candidato",
    versao: 1,
    titulo: "A missão por dentro",
    casa: (r) => /^\/porta-voz\/missao\//.test(r),
    passos: [
      {
        alvo: "ver-entrega",
        titulo: "O vídeo pronto fica aqui",
        texto: "Assista antes de decidir. Abre no Drive do editor, numa aba nova.",
      },
      {
        alvo: "aprovar-missao",
        titulo: "Você é quem aprova",
        texto:
          "Gostou, aprova e fecha. Faltou alguma coisa, pede o ajuste e escreve o que mudar — o editor recebe o recado.",
      },
      {
        alvo: "conversa-missao",
        titulo: "Dúvida se resolve aqui",
        texto:
          "A conversa fica presa na missão, então ninguém perde o combinado no meio de outro assunto.",
      },
    ],
  },
  {
    chave: "editor",
    versao: 1,
    titulo: "A fila do editor",
    casa: (r) => r === "/editor",
    passos: [
      {
        alvo: "aceitar-missao",
        titulo: "Uma missão de cada vez",
        texto:
          "Aceitou, ela é sua até entregar ou devolver. Não tem relógio correndo contra você.",
      },
      {
        alvo: "abrir-bruto",
        titulo: "O bruto está no Drive de quem pediu",
        texto:
          "Se o Drive pedir permissão, peça a liberação na conversa da missão — hoje esse acesso ainda é na mão.",
      },
      {
        alvo: "campo-entrega",
        titulo: "Entregar é colar um link",
        texto: "Nenhum arquivo passa pelo nosso servidor. O vídeo fica no seu Drive.",
        demo: "entrega",
      },
    ],
  },
  {
    chave: "agenda",
    versao: 1,
    titulo: "Sua agenda",
    casa: (r) => r === "/agenda",
    passos: [
      {
        alvo: "grade-semana",
        titulo: "Por que a missão não chega",
        texto:
          "Duas coisas decidem: esta grade e a aba aberta. O sistema só chama quem apareceu nos últimos minutos — com a Oficina fechada, a oferta vai pro próximo. Bloco desmarcado aqui também tira você da vez naquele horário.",
      },
      {
        alvo: "mesa-agora",
        titulo: "O que está na sua mesa",
        texto:
          "Uma missão de cada vez. Enquanto esta não for entregue ou devolvida, nenhuma outra é oferecida a você.",
      },
    ],
  },
  {
    chave: "perfil-editor",
    versao: 1,
    titulo: "Seu perfil",
    casa: (r) => r === "/perfil",
    passos: [
      {
        alvo: "cartao-nivel",
        titulo: "O nível sobe sozinho",
        texto:
          "É o número de entregas aprovadas que manda: 10 vira Oficial, 30 Artífice, 60 Mestre-Artesão. Não tem como pedir promoção — e nem precisa.",
      },
      {
        alvo: "cartao-portfolio",
        titulo: "O portfólio se preenche sozinho",
        texto:
          "Cada entrega aprovada entra aqui. É o que o candidato olha antes de confiar um vídeo a você.",
      },
    ],
  },
  {
    chave: "contas",
    versao: 1,
    titulo: "Gerenciar pessoas",
    casa: (r) => r === "/inspetor/contas",
    passos: [
      {
        alvo: "busca-pessoas",
        titulo: "Ache pela conta, não pela memória",
        texto: "Busca por nome, apelido ou e-mail. Toque na pessoa pra abrir o que dá pra fazer.",
      },
    ],
  },
  {
    chave: "perfil-candidato",
    versao: 1,
    titulo: "Seu perfil",
    casa: (r) => r === "/porta-voz/perfil",
    passos: [
      {
        alvo: "editar-perfil",
        titulo: "Isto é o que o editor vê",
        texto:
          "Bandeiras, tom e palavras-chave não são enfeite: é por aqui que o editor entende o seu jeito antes de cortar o primeiro vídeo.",
      },
    ],
  },
  {
    chave: "panorama",
    versao: 1,
    titulo: "Panorama",
    casa: (r) => r === "/inspetor/panorama",
    passos: [
      {
        alvo: "numeros-panorama",
        titulo: "O sistema num relance",
        texto:
          "“Editores livres” é quem pode receber missão agora: sem nada em mãos e sem oferta pendente. Fila cheia com esse número em zero significa que falta gente, não que o sistema travou.",
      },
      {
        alvo: "fila-edicao",
        titulo: "Esta é a ordem de entrega",
        texto:
          "O sistema oferece de cima pra baixo. Suba o que for urgente — vale já na próxima rodada. Missão parada há 3 dias ou mais fica marcada em dourado.",
      },
      {
        alvo: "em-voo",
        titulo: "O que já saiu da fila",
        texto:
          "A mais parada vem primeiro. Passou de 5 dias no mesmo lugar, a borda fica vermelha — normalmente é editor sumido ou candidato que não respondeu.",
      },
    ],
  },
  {
    chave: "inspetor",
    versao: 1,
    titulo: "Controle de qualidade",
    casa: (r) => r === "/inspetor",
    passos: [
      {
        alvo: "nota-editor",
        titulo: "A nota move os números",
        texto:
          "As estrelas são opcionais, mas é o que forma a média do editor e faz o nível subir.",
      },
      {
        alvo: "decisao-inspetor",
        titulo: "Aprovar ou pedir reedição",
        texto:
          "Pedindo reedição, escreva o que precisa mudar. O editor recebe por e-mail e a missão volta pras mãos dele.",
      },
    ],
  },
];

/** o roteiro da rota atual, ou null se a tela não tem guia */
export function guiaDaRota(rota: string): Roteiro | null {
  const achado = ROTEIROS.find((r) => r.casa(rota));
  if (!achado) return null;
  return {
    chave: achado.chave,
    versao: achado.versao,
    titulo: achado.titulo,
    passos: achado.passos,
  };
}

/** chave do localStorage — inclui a versão pra roteiro novo voltar a aparecer */
export function chaveVisto(roteiro: Roteiro) {
  return `oa-guia:${roteiro.chave}:v${roteiro.versao}`;
}
