// Perfil do candidato (porta-voz) vindo do banco. Mesma separação de
// lib/perfil-db.ts: fica fora de lib/candidatos.ts porque aquele arquivo é
// importado por componentes "use client" — puxar o driver do Postgres pra
// lá quebraria o build.
import { sql } from "@/lib/db";
import { LIMITES, fotoValida, limitar, limitarLista, limitarOuNulo } from "@/lib/limites";
import { TINT_PADRAO, type Candidato, type RedesSociais } from "@/lib/candidatos";

export type OnboardingCandidato = {
  nome: string;
  fotoUrl: string;
  cargo: string;
  disputaPor: string;
  anoEleicao: string;
  localizacao: string;
  bandeiras: string[];
  tomComunicacao: string;
  palavrasChave: string[];
  redes: RedesSociais;
  bio: string;
  perfilCompleto: boolean;
};

export async function lerOnboardingCandidato(userId: number): Promise<OnboardingCandidato | null> {
  const [l] = await sql`
    SELECT nome, foto_url, cargo, disputa_por, ano_eleicao, localizacao,
           bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio,
           perfil_completo
    FROM users WHERE id = ${userId}
  `;
  if (!l) return null;
  return {
    nome: l.nome ?? "",
    fotoUrl: l.foto_url ?? "",
    cargo: l.cargo ?? "",
    disputaPor: l.disputa_por ?? "",
    anoEleicao: l.ano_eleicao ?? "2026",
    localizacao: l.localizacao ?? "",
    bandeiras: l.bandeiras ?? [],
    tomComunicacao: l.tom_comunicacao ?? "",
    palavrasChave: l.palavras_chave ?? [],
    redes: (l.redes_sociais ?? {}) as RedesSociais,
    bio: l.bio ?? "",
    perfilCompleto: l.perfil_completo ?? false,
  };
}

export async function salvarOnboardingCandidato(
  userId: number,
  dados: {
    nome: string;
    fotoUrl?: string;
    cargo?: string;
    disputaPor?: string;
    anoEleicao?: string;
    localizacao?: string;
    bandeiras?: string[];
    tomComunicacao?: string;
    palavrasChave?: string[];
    redes?: RedesSociais;
    bio?: string;
  }
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const nome = limitar(dados.nome, LIMITES.nome);
  if (!nome) return { ok: false, erro: "Digite seu nome." };
  if (!dados.cargo?.trim()) return { ok: false, erro: "Escolha o cargo." };
  if (!dados.localizacao?.trim()) return { ok: false, erro: "Preencha a região." };

  // mesma trava do editor: a foto vira data URL e trafega inteira toda vez
  // que o perfil (ou o card na fila) renderiza
  if (!fotoValida(dados.fotoUrl)) {
    return { ok: false, erro: "A foto precisa ser imagem e ter menos de 1,5 MB." };
  }

  const palavrasChave = limitarLista(dados.palavrasChave, 3);

  await sql`
    UPDATE users SET
      nome = ${nome},
      foto_url = ${dados.fotoUrl?.trim() || null},
      cargo = ${limitarOuNulo(dados.cargo, LIMITES.tag)},
      disputa_por = ${limitarOuNulo(dados.disputaPor, LIMITES.tag)},
      ano_eleicao = ${limitarOuNulo(dados.anoEleicao, 4)},
      localizacao = ${limitarOuNulo(dados.localizacao, LIMITES.localizacao)},
      bandeiras = ${limitarLista(dados.bandeiras, 12)},
      tom_comunicacao = ${limitarOuNulo(dados.tomComunicacao, LIMITES.tag)},
      palavras_chave = ${palavrasChave},
      -- sql.json e nao JSON.stringify: mesma armadilha do disponibilidade no
      -- onboarding do editor (JSON.stringify()::jsonb guarda string, nao objeto)
      redes_sociais = ${sql.json(dados.redes ?? {})},
      bio = ${limitarOuNulo(dados.bio, LIMITES.bio)},
      perfil_completo = true
    WHERE id = ${userId}
  `;
  return { ok: true };
}

type LinhaCandidato = {
  apelido: string;
  nome: string;
  foto_url: string | null;
  cargo: string | null;
  disputa_por: string | null;
  ano_eleicao: string | null;
  localizacao: string | null;
  bandeiras: string[] | null;
  tom_comunicacao: string | null;
  palavras_chave: string[] | null;
  redes_sociais: RedesSociais | null;
  bio: string | null;
  criado_em: string;
};

function linhaParaCandidato(l: LinhaCandidato): Candidato {
  return {
    slug: l.apelido,
    nome: l.nome,
    foto: l.foto_url ?? undefined,
    cargo: l.cargo ?? "",
    disputaPor: l.disputa_por ?? undefined,
    anoEleicao: l.ano_eleicao ?? undefined,
    local: l.localizacao ?? "",
    proximidade: 0,
    bio: l.bio ?? "",
    tint: TINT_PADRAO,
    tomComunicacao: l.tom_comunicacao ?? undefined,
    bandeiras: l.bandeiras ?? [],
    palavrasChave: l.palavras_chave ?? [],
    redes: l.redes_sociais ?? {},
    desde: new Date(l.criado_em).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
  };
}

/** O próprio porta-voz vendo o próprio perfil (/porta-voz/perfil) — ao
 * contrário de lerCandidatoPublico, mostra mesmo sem perfil_completo (o
 * dono pode ver o rascunho vazio, só um estranho não). */
export async function lerCandidatoProprio(userId: number): Promise<Candidato | null> {
  const [l] = await sql`
    SELECT apelido, nome, foto_url, cargo, disputa_por, ano_eleicao, localizacao,
           bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio, criado_em
    FROM users WHERE id = ${userId} AND papel = 'voz'
  `;
  return l ? linhaParaCandidato(l as unknown as LinhaCandidato) : null;
}

/** Perfil público de um porta-voz real, pra /candidato/[slug]. Só devolve
 * se o perfil já foi completado — senão a página não tem o que mostrar. */
export async function lerCandidatoPublico(apelido: string): Promise<Candidato | null> {
  const [l] = await sql`
    SELECT apelido, nome, foto_url, cargo, disputa_por, ano_eleicao, localizacao,
           bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio, criado_em
    FROM users
    WHERE lower(apelido) = lower(${apelido}) AND papel = 'voz' AND perfil_completo = true
  `;
  return l ? linhaParaCandidato(l as unknown as LinhaCandidato) : null;
}

/** Leitura em lote pras filas do editor — uma query só, não uma por card. */
export async function lerCandidatosPorApelidos(apelidos: string[]): Promise<Map<string, Candidato>> {
  if (apelidos.length === 0) return new Map();
  const linhas = await sql`
    SELECT apelido, nome, foto_url, cargo, disputa_por, ano_eleicao, localizacao,
           bandeiras, tom_comunicacao, palavras_chave, redes_sociais, bio, criado_em
    FROM users
    WHERE apelido = ANY(${apelidos}) AND papel = 'voz'
  `;
  const mapa = new Map<string, Candidato>();
  for (const l of linhas as unknown as LinhaCandidato[]) mapa.set(l.apelido, linhaParaCandidato(l));
  return mapa;
}
