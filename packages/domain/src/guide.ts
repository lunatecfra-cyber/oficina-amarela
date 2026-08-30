export type DemoType = "drive" | "entrega";
export type Demo = DemoType;
export type GuideDemoType = DemoType;

export type GuideStep = {
  target: string;
  title: string;
  text: string;
  demo?: DemoType;
  // aliases
  alvo?: string;
  titulo?: string;
  texto?: string;
};

export type PassoGuia = GuideStep;

export type GuideScript = {
  key: string;
  version: number;
  title: string;
  steps: GuideStep[];
  // aliases
  chave?: string;
  versao?: number;
  titulo?: string;
  passos?: GuideStep[];
};

export type Roteiro = GuideScript;
export type RouteScript = GuideScript;

const SCRIPTS: readonly (GuideScript & { match: (route: string) => boolean })[] = [
  {
    key: "spokesperson",
    version: 1,
    title: "Suas missões",
    match: (r) => r === "/spokesperson" || r === "/porta-voz",
    steps: [
      {
        target: "nova-missao",
        title: "Tudo começa aqui",
        text: "Você grava no celular, joga na sua pasta do Drive e descreve o que quer. Quem edita vem depois.",
      },
      {
        target: "cartao-missao",
        title: "O cartão conta o que está acontecendo",
        text: "Na fila, com o editor, ou pronto pra assistir. Quando o vídeo chega, o cartão avisa em dourado — é só tocar.",
      },
    ],
  },
  {
    key: "new-mission",
    version: 1,
    title: "Criar uma missão",
    match: (r) => r === "/spokesperson/new-mission" || r === "/porta-voz/nova-pauta",
    steps: [
      {
        target: "campo-drive",
        title: "O link do Drive",
        text: "O vídeo bruto nunca sai do seu Drive — a gente só passa o link.",
        demo: "drive",
      },
      {
        target: "instrucoes-edicao",
        title: "Diga como quer o vídeo",
        text: "Tom, cor, referências e formato. Quanto mais claro, mais rápido o editor entrega do jeito que você imaginou.",
      },
      {
        target: "regras-tse",
        title: "Regras eleitorais",
        text: "Identificação da campanha, marca d'água e prazos da lei. A Oficina confere antes de ir pro ar.",
      },
    ],
  },
  {
    key: "mission-detail",
    version: 1,
    title: "Acompanhando o vídeo",
    match: (r) => /^\/spokesperson\/mission\//.test(r) || /^\/porta-voz\/missao\//.test(r),
    steps: [
      {
        target: "ver-entrega",
        title: "Assista ao vídeo pronto",
        text: "Quando o editor entrega, o link aparece aqui. Você pode assistir e conferir antes de aprovar.",
      },
      {
        target: "conversa-missao",
        title: "Fale com o editor",
        text: "Tire dúvidas, alinhe detalhes e acompanhe o andamento direto por aqui.",
      },
    ],
  },
  {
    key: "spokesperson-profile",
    version: 1,
    title: "Seu perfil na guilda",
    match: (r) => r === "/spokesperson/profile" || r === "/porta-voz/perfil",
    steps: [
      {
        target: "editar-perfil",
        title: "Mantenha seus dados em dia",
        text: "Cargo, redes sociais e foto. É o que os editores veem quando pegam suas missões.",
      },
    ],
  },
  {
    key: "editor-desk",
    version: 1,
    title: "Sua bancada de trabalho",
    match: (r) => r === "/editor",
    steps: [
      {
        target: "missao-em-maos",
        title: "Sua missão atual",
        text: "O vídeo que você está editando agora. Pegue o bruto no Drive, monte e entregue quando estiver pronto.",
      },
      {
        target: "oferta-missao",
        title: "Próximas missões",
        text: "As missões chegam até você uma por uma. Aceite pra começar a editar ou passe se não puder pegar agora.",
      },
      {
        target: "desafios-diarios",
        title: "Desafios da forja",
        text: "Complete tarefas diárias pra ganhar XP, subir de nível e desbloquear novas conquistas na guilda.",
      },
    ],
  },
  {
    key: "editor-profile",
    version: 1,
    title: "Seu perfil de artesão",
    match: (r) => r === "/profile" || r === "/perfil",
    steps: [
      {
        target: "cartao-nivel",
        title: "Seu nível na guilda",
        text: "De Aprendiz a Mestre-Artesão. Cada entrega aprovada soma XP e aproxima você do próximo nível.",
      },
      {
        target: "cartao-portfolio",
        title: "Portfólio automático",
        text: "Vídeos aprovados entram aqui sozinhos. Mostre pros porta-vozes o que você já fez.",
      },
    ],
  },
  {
    key: "inspector",
    version: 1,
    title: "Controle de qualidade",
    match: (r) => r === "/inspector" || r === "/inspetor",
    steps: [
      {
        target: "nota-editor",
        title: "A nota move os números",
        text: "As estrelas são opcionais, mas é o que forma a média do editor e faz o nível subir.",
      },
      {
        target: "decisao-inspetor",
        title: "Aprovar ou pedir reedição",
        text: "Pedindo reedição, escreva o que precisa mudar. O editor recebe por e-mail e a missão volta pras mãos dele.",
      },
    ],
  },
];

export function getRouteGuide(route: string): GuideScript | null {
  const found = SCRIPTS.find((r) => r.match(route));
  if (!found) return null;
  return {
    key: found.key,
    version: found.version,
    title: found.title,
    steps: found.steps.map((s) => ({
      ...s,
      alvo: s.target,
      titulo: s.title,
      texto: s.text,
    })),
    chave: found.key,
    versao: found.version,
    titulo: found.title,
    passos: found.steps.map((s) => ({
      ...s,
      alvo: s.target,
      titulo: s.title,
      texto: s.text,
    })),
  };
}

export const guiaDaRota = getRouteGuide;

export function viewedGuideKey(script: GuideScript): string {
  const key = script.key ?? script.chave;
  const ver = script.version ?? script.versao;
  return `oa-guia:${key}:v${ver}`;
}

export const seenKey = viewedGuideKey;
export const chaveVisto = viewedGuideKey;
