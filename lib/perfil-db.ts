// Perfil do editor vindo do banco.
//
// Fica AQUI e não em lib/perfil.ts porque aquele arquivo é importado por
// componentes "use client" (fila-pautas, desafios-dia) — puxar o driver do
// Postgres pra lá jogaria o banco dentro do bundle do navegador e quebraria
// o build. lib/perfil.ts continua sendo só tipos + dados de demonstração.
import { sql } from "@/lib/db";
import { LIMITES, fotoValida, limitar, limitarLista, limitarOuNulo } from "@/lib/limites";
import type {
  EditorRanking,
  ItemHistorico,
  ItemPortfolio,
  Nivel,
  PerfilEditor,
} from "@/lib/perfil";

export type PerfilEditavel = {
  headline: string[];
  bio: string | null;
  localizacao: string | null;
};

export async function lerPerfilEditavel(userId: number): Promise<PerfilEditavel | null> {
  const [linha] = await sql`
    SELECT headline, bio, localizacao FROM users WHERE id = ${userId}
  `;
  if (!linha) return null;
  return {
    headline: normalizarLista(linha.headline),
    bio: linha.bio ?? null,
    localizacao: linha.localizacao ?? null,
  };
}

export async function salvarPerfilEditavel(
  userId: number,
  dados: { headline?: string[]; bio?: string; localizacao?: string }
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    await sql`
      UPDATE users SET
        headline = ${dados.headline ? sql.json(limitarLista(dados.headline, 5)) : null},
        bio = ${limitarOuNulo(dados.bio, LIMITES.bio)},
        localizacao = ${limitarOuNulo(dados.localizacao, LIMITES.localizacao)}
      WHERE id = ${userId}
    `;
    return { ok: true };
  } catch (err) {
    console.error("[perfil] erro ao salvar perfil editável:", err);
    return { ok: false, erro: "Erro ao salvar perfil. Tente novamente." };
  }
}

export type OnboardingEditor = {
  nome: string;
  fotoUrl: string;
  localizacao: string;
  headline: string[];
  bio: string;
  softwares: string[];
  estilos: string[];
  nivelEdicao: string;
  setupPc: string;
  portfolioLink: string;
  nicho: string[];
  disponibilidade: boolean[][];
  perfilCompleto: boolean;
};

/**
 * Normaliza uma lista de tags vinda do banco.
 *
 * Três formatos aparecem aqui, e os três precisam funcionar:
 *
 * 1. `string[]` — colunas TEXT[] de verdade (softwares, estilos, nicho).
 * 2. Texto com JSON dentro — é o caso do `headline`. A coluna é TEXT, mas
 *    `salvarPerfilEditavel` grava com `sql.json(...)`, então volta como a
 *    string `'["Cortes impactantes","Ritmo rápido"]'`. Sem fazer o parse, a
 *    tela imprimia o JSON cru, colchetes e aspas incluídos.
 * 3. Texto simples — headline antiga, de antes de virar multi-seleção.
 */
function normalizarLista(valor: unknown): string[] {
  if (Array.isArray(valor)) return valor.filter((x) => typeof x === "string");
  if (typeof valor !== "string" || !valor.trim()) return [];

  const texto = valor.trim();
  if (texto.startsWith("[")) {
    try {
      const lido: unknown = JSON.parse(texto);
      if (Array.isArray(lido)) return lido.filter((x) => typeof x === "string");
    } catch {
      // não era JSON válido: trata como texto simples, abaixo
    }
  }
  return [texto];
}

/**
 * Devolve a grade sempre como boolean[][], ou [] se não der.
 * Aceita string porque linhas gravadas antes da correção do sql.json ficaram
 * com JSON duplamente codificado no banco.
 */
function normalizarGrade(valor: unknown): boolean[][] {
  let g = valor;
  if (typeof g === "string") {
    try {
      g = JSON.parse(g);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(g)) return [];
  return g.map((linha) => (Array.isArray(linha) ? linha.map(Boolean) : []));
}

export async function lerOnboardingEditor(userId: number): Promise<OnboardingEditor | null> {
  try {
    const [l] = await sql`
      SELECT nome, foto_url, localizacao, headline, bio, softwares, estilos, nivel_edicao,
             setup_pc, portfolio_link, nicho, disponibilidade, perfil_completo
      FROM users WHERE id = ${userId}
    `;
    if (!l) return null;
    return {
      nome: l.nome ?? "",
      fotoUrl: l.foto_url ?? "",
      localizacao: l.localizacao ?? "",
      headline: normalizarLista(l.headline),
      bio: l.bio ?? "",
      softwares: l.softwares ?? [],
      estilos: l.estilos ?? [],
      nivelEdicao: l.nivel_edicao ?? "",
      setupPc: l.setup_pc ?? "",
      portfolioLink: l.portfolio_link ?? "",
      nicho: l.nicho ?? [],
      disponibilidade: normalizarGrade(l.disponibilidade),
      perfilCompleto: l.perfil_completo ?? false,
    };
  } catch {
    return null;
  }
}

export async function salvarOnboardingEditor(
  userId: number,
  dados: {
    nome: string;
    fotoUrl?: string;
    localizacao?: string;
    headline?: string[];
    bio?: string;
    softwares?: string[];
    estilos?: string[];
    nivelEdicao?: string;
    setupPc?: string;
    portfolioLink?: string;
    nicho?: string[];
    // a Forja saiu do onboarding (vira /agenda) — undefined aqui significa
    // "não mexe", pra reabrir o onboarding depois não apagar o que já foi
    // marcado na agenda. Ver COALESCE abaixo.
    disponibilidade?: boolean[][];
  }
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const nome = limitar(dados.nome, LIMITES.nome);
  if (!nome) return { ok: false, erro: "Digite seu nome." };

  // a foto é gravada como data URL e trafega inteira toda vez que o perfil
  // renderiza — aqui é o único ponto que consegue recusar uma grande
  if (!fotoValida(dados.fotoUrl)) {
    return { ok: false, erro: "A foto precisa ser imagem e ter menos de 1,5 MB." };
  }

  // corta no teto em vez de recusar: o formulário já impede passar disso, e
  // recusar aqui só perderia o resto do que a pessoa preencheu
  const estilos = limitarLista(dados.estilos, 3);

  // sql.json(x) quando há grade nova, NULL quando não há — COALESCE mantém o
  // valor atual da coluna nesse segundo caso, em vez de zerar
  const gradeNova = dados.disponibilidade ? sql.json(dados.disponibilidade) : null;

  await sql`
    UPDATE users SET
      nome = ${nome},
      foto_url = ${dados.fotoUrl?.trim() || null},
      localizacao = ${limitarOuNulo(dados.localizacao, LIMITES.localizacao)},
      headline = ${dados.headline ? sql.json(limitarLista(dados.headline, 5)) : null},
      bio = ${limitarOuNulo(dados.bio, LIMITES.bio)},
      softwares = ${limitarLista(dados.softwares, 12)},
      estilos = ${estilos},
      nivel_edicao = ${limitarOuNulo(dados.nivelEdicao, LIMITES.tag)},
      setup_pc = ${limitarOuNulo(dados.setupPc, LIMITES.tag)},
      portfolio_link = ${limitarOuNulo(dados.portfolioLink, LIMITES.link)},
      nicho = ${limitarLista(dados.nicho, 4)},
      -- sql.json e nao JSON.stringify: com a string, o Postgres guardava um
      -- JSON *string* dentro do jsonb (duplamente codificado) e a grade
      -- voltava como texto, nao como array
      disponibilidade = COALESCE(${gradeNova}, disponibilidade),
      perfil_completo = true
    WHERE id = ${userId}
  `;
  return { ok: true };
}

/** Perfil completo do editor: conta + números + portfólio + conquistas. */
export async function lerPerfilEditor(userId: number): Promise<PerfilEditor | null> {
  try {
    const [conta] = await sql`
      SELECT apelido, nome, headline, bio, localizacao, criado_em,
             entregues, reputacao, streak, nota, nivel,
             foto_url, softwares, estilos, nicho, nivel_edicao, setup_pc
      FROM users WHERE id = ${userId}
    `;
    if (!conta) return null;

    const [itens, medalhas, entregas] = await Promise.all([
      sql`SELECT id, titulo, formato, porta_voz, tint, link_video
          FROM portfolio WHERE user_id = ${userId} ORDER BY criado_em DESC`,
      sql`SELECT nome, icone FROM conquistas WHERE user_id = ${userId}
          ORDER BY conquistado_em DESC`,
      sql`SELECT p.id, p.titulo, p.status, p.criada_em, u.nome AS porta_voz
          FROM pautas p
          JOIN users u ON u.id = p.porta_voz_id
          WHERE p.reservada_por_id = ${userId}
            AND p.status IN ('aprovada','finalizada','reedicao')
          ORDER BY p.criada_em DESC`,
    ]);

    const portfolio: ItemPortfolio[] = itens.map((i) => ({
      id: `pf-${i.id}`,
      titulo: i.titulo,
      formato: i.formato,
      portaVoz: i.porta_voz,
      tint: i.tint ?? "linear-gradient(135deg,#3a3a42,#12121a)",
    }));

    return {
      apelido: conta.apelido,
      nome: conta.nome,
      headline: normalizarLista(conta.headline),
      local: conta.localizacao ?? "",
      desde: new Date(conta.criado_em).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
      bio: conta.bio ?? "",
      fotoUrl: conta.foto_url ?? undefined,
      softwares: normalizarLista(conta.softwares),
      estilos: normalizarLista(conta.estilos),
      nicho: normalizarLista(conta.nicho),
      nivelEdicao: conta.nivel_edicao ?? undefined,
      setupPc: conta.setup_pc ?? undefined,
      entregues: conta.entregues,
      nota: conta.nota === null ? null : Number(conta.nota),
      reputacao: conta.reputacao,
      streak: conta.streak,
      nivel: conta.nivel as Nivel,
      portfolio,
      conquistas: medalhas.map((m) => ({ icone: m.icone, nome: m.nome })),
      historico: entregas.map(
        (e): ItemHistorico => ({
          id: `db-${e.id}`,
          titulo: e.titulo,
          portaVoz: e.porta_voz,
          data: new Date(e.criada_em).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
          resultado: e.status === "reedicao" ? "reedicao" : "aprovada",
        })
      ),
    };
  } catch {
    return null;
  }
}

/**
 * O ranking real da guilda, direto de users.
 *
 * Antes isto era um array fake em lib/perfil.ts, então nenhum editor de
 * verdade aparecia — e o realce de "Você" caía sempre no mesmo apelido
 * hardcoded, independente de quem estivesse logado.
 *
 * Entra quem completou o perfil OU já entregou alguma coisa. O `entregues > 0`
 * não é redundante: quem trabalhou ganhou o lugar na lista, mesmo com o
 * cadastro pela metade. O que fica de fora é só conta recém-criada e parada.
 */
export async function rankingEditores(
  limite = 50
): Promise<(EditorRanking & { id: number; nome: string })[]> {
  const linhas = await sql`
    SELECT id, apelido, nome, nivel, reputacao, entregues, streak
    FROM users
    WHERE papel = 'editor' AND (perfil_completo = true OR entregues > 0)
    ORDER BY reputacao DESC, entregues DESC, apelido ASC
    LIMIT ${limite}
  `;
  return linhas.map((l) => ({
    id: l.id,
    apelido: l.apelido,
    nome: l.nome,
    nivel: l.nivel as Nivel,
    reputacao: l.reputacao,
    entregues: l.entregues,
    streak: l.streak,
  }));
}
