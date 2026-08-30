/**
 * O repertório da oficina: o que o editor abre no meio de um corte.
 *
 * REGRA DESTA LISTA: só entra `url` que existe de verdade. O que a guilda ainda
 * não escolheu fica com `status: "em-breve"` e aparece na tela como espaço
 * reservado — nunca com um link inventado, que só faz a pessoa perder tempo
 * clicando. Quem for preencher mexe só aqui.
 *
 * Os links abaixo vieram da lista que já estava em `app/ferramentas/page.tsx`.
 */

export type ToolStatus = "disponivel" | "em-breve";

export type Tool = {
  /** como a ferramenta é conhecida */
  name: string;
  /** uma linha: pra que serve. Sem propaganda. */
  what: string;
  /** endereço real; ausente quando `status` é "em-breve" */
  url?: string;
  status?: ToolStatus;
  /**
   * Palavras pelas quais a pessoa procura isso — não sinônimos do nome, mas o
   * PROBLEMA que ela tem. Sem elas a busca dependia da frase de descrição, e
   * "imagem" não achava o Pexels ("foto e vídeo em 4K") enquanto "fundo"
   * trazia a música de fundo junto com o removedor de fundo.
   */
  tags?: string[];
};

export type ToolGroupId = "musica" | "audio" | "edicao" | "criacao";

export type ToolGroup = {
  id: ToolGroupId;
  name: string;
  /** o que a pessoa vem procurar aqui */
  what: string;
  emoji: string;
  tools: Tool[];
};

/** O Drive da guilda — o único repertório próprio que já existe. */
export const GUILD_DRIVE =
  "https://drive.google.com/drive/folders/11_jSlkDsn9XQdvbaVCxi4dxpnFdiGNIO";

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "musica",
    name: "Música e trilha",
    what: "O que toca por baixo do vídeo.",
    emoji: "🎵",
    tools: [
      {
        name: "Uppbeat",
        tags: ["musica", "trilha", "fundo-musical"],
        what: "Música de fundo liberada pra quem publica.",
        url: "https://uppbeat.io",
      },
      {
        name: "Mixkit Música",
        tags: ["musica", "trilha", "corte", "fundo-musical"],
        what: "Trilhas grátis, boas pra corte e transição.",
        url: "https://mixkit.co/free-stock-music",
      },
      {
        name: "Pixabay Música",
        tags: ["musica", "trilha", "fundo-musical"],
        what: "Acervo grande, sem cadastro.",
        url: "https://pixabay.com/music",
      },
      {
        name: "Drive de repertório de músicas",
        tags: ["repertorio", "drive", "musica"],
        what: "Pasta própria da Oficina, ainda por montar.",
        status: "em-breve",
      },
    ],
  },
  {
    id: "audio",
    name: "Áudio e efeitos",
    what: "Ruído, impacto, transição e o que dá graça.",
    emoji: "🔊",
    tools: [
      {
        name: "Freesound",
        tags: ["sfx", "efeito", "som", "impacto", "destaque", "humor"],
        what: "Efeito sonoro de quase tudo, buscável por palavra.",
        url: "https://freesound.org",
      },
      {
        name: "Mixkit Efeitos",
        tags: ["sfx", "efeito", "transicao", "impacto", "destaque"],
        what: "Transição, impacto e destaque prontos.",
        url: "https://mixkit.co/free-sound-effects",
      },
      {
        name: "Adobe Podcast",
        tags: ["audio", "voz", "melhorar-audio", "ruido"],
        what: "Limpa voz gravada em lugar ruim.",
        url: "https://podcast.adobe.com/enhance",
      },
      {
        name: "UVR5",
        tags: ["audio", "voz", "separar"],
        what: "Separa a voz da música de uma faixa só.",
        url: "https://ultimatevocalremover.com",
      },
      {
        name: "Repertório de áudios",
        tags: ["repertorio", "drive", "sfx", "audio"],
        what: "Pasta própria de SFX da Oficina, ainda por montar.",
        status: "em-breve",
      },
    ],
  },
  {
    id: "edicao",
    name: "Edição rápida",
    what: "Resolver uma coisa só, sem abrir o projeto inteiro.",
    emoji: "✂️",
    tools: [
      {
        name: "remove.bg",
        tags: ["remover-fundo", "imagem", "recorte"],
        what: "Tira o fundo de uma imagem num clique.",
        url: "https://remove.bg",
      },
      {
        name: "123apps",
        tags: ["cortar", "redimensionar", "converter", "audio"],
        what: "Cortar, redimensionar e converter direto no navegador.",
        url: "https://123apps.com",
      },
      {
        name: "Shutter Encoder",
        tags: ["converter", "formato", "codec"],
        what: "Converte formato e codec sem perder qualidade.",
        url: "https://www.shutterencoder.com",
      },
      {
        name: "Handbrake",
        tags: ["converter", "comprimir", "formato"],
        what: "Deixa o arquivo leve pra subir.",
        url: "https://handbrake.fr",
      },
      {
        name: "CapCut",
        tags: ["legenda", "legendar", "cortar", "vertical"],
        what: "Legenda automática e corte vertical.",
        url: "https://capcut.com/pt-br",
      },
      {
        name: "Remover fundo de vídeo",
        tags: ["remover-fundo", "video"],
        what: "Sem ferramenta escolhida pela guilda ainda.",
        status: "em-breve",
      },
      {
        name: "Cortar silêncio",
        tags: ["cortar", "silencio", "audio"],
        what: "Sem ferramenta escolhida pela guilda ainda.",
        status: "em-breve",
      },
    ],
  },
  {
    id: "criacao",
    name: "Criação",
    what: "Capa, imagem, cor e tipografia.",
    emoji: "🎨",
    tools: [
      {
        name: "Pexels",
        tags: ["imagem", "foto", "video", "banco-de-imagens"],
        what: "Foto e vídeo em 4K, uso livre.",
        url: "https://pexels.com/pt-br",
      },
      {
        name: "Pixabay",
        tags: ["imagem", "foto", "video", "banco-de-imagens"],
        what: "Banco grande de imagem e vídeo.",
        url: "https://pixabay.com",
      },
      {
        name: "Freepik",
        tags: ["imagem", "vetor", "arte", "banco-de-imagens"],
        what: "Vetor, ícone e arte pronta.",
        url: "https://freepik.com",
      },
      {
        name: "Flaticon",
        tags: ["imagem", "icone", "vetor"],
        what: "Ícone solto pra encaixar na tela.",
        url: "https://flaticon.com",
      },
      {
        name: "PNGEgg",
        tags: ["imagem", "recorte", "png", "transparente"],
        what: "Recorte transparente pra colar por cima.",
        url: "https://pngegg.com",
      },
      {
        name: "WhatFont",
        tags: ["fonte", "tipografia", "referencia"],
        what: "Descobre a fonte de um site só passando o mouse.",
        url: "https://chromewebstore.google.com/detail/whatfont/jabopgfdobjimomedpjipgjaooicahmo",
      },
      {
        name: "Gerar thumbnail",
        tags: ["thumbnail", "capa", "imagem"],
        what: "Sem ferramenta escolhida pela guilda ainda.",
        status: "em-breve",
      },
      {
        name: "Paleta de cores",
        tags: ["cor", "paleta"],
        what: "Sem ferramenta escolhida pela guilda ainda.",
        status: "em-breve",
      },
      {
        name: "Banco de fontes",
        tags: ["fonte", "tipografia"],
        what: "Sem ferramenta escolhida pela guilda ainda.",
        status: "em-breve",
      },
      {
        name: "Referências visuais",
        tags: ["referencia", "inspiracao", "repertorio"],
        what: "Pasta de referência da Oficina, ainda por montar.",
        status: "em-breve",
      },
    ],
  },
];

/**
 * Os atalhos do topo — escritos como a pessoa pensa, não como o menu se chama.
 * Cada um joga um termo na busca; `match` é o que a busca vai procurar.
 */
export const SHORTCUTS: Array<{ label: string; match: string }> = [
  { label: "Preciso cortar fundo", match: "remover-fundo" },
  { label: "Quero música de fundo", match: "fundo-musical" },
  { label: "Preciso de som de transição", match: "transicao" },
  { label: "Quero legendar", match: "legenda" },
  { label: "Preciso de imagem", match: "banco-de-imagens" },
  { label: "Preciso converter", match: "converter" },
];

/** Tira acento pra busca não depender de como a pessoa digitou. */
export function normalize(text: string): string {
  // ̀-ͯ é a faixa dos acentos que o NFD separa da letra
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function matchesTool(tool: Tool, groupName: string, term: string): boolean {
  if (!term) return true;
  const t = normalize(term);
  return (
    normalize(tool.name).includes(t) ||
    normalize(tool.what).includes(t) ||
    normalize(groupName).includes(t) ||
    (tool.tags ?? []).some((tag) => normalize(tag).includes(t))
  );
}
