// Funções de gestão de pessoas — só o inspetor (papel "admin") usa.
//
// Fica em arquivo próprio (e não em lib/contas.ts) porque é uma superfície
// diferente: lista/detalha/bane, em vez de cadastra/autentica. Misturar
// aumentaria o risco de o middleware (que importa lib/contas indiretamente)
// acabar puxando coisas pesadas sem querer.
import { sql } from "@/lib/db";
import type { Papel } from "@/lib/sessao";

export type UsuarioLista = {
  id: number;
  apelido: string;
  nome: string;
  email: string;
  papel: Papel;
  banido: boolean;
  perfilCompleto: boolean;
  criadoEm: string;
};

export type DetalheUsuario = UsuarioLista & {
  fotoUrl: string | null;
  localizacao: string | null;
  bio: string | null;
  entregues: number;
  reputacao: number;
  streak: number;
  nota: number | null;
  // perfil de candidato (só faz sentido pra papel "voz")
  cargo: string | null;
  disputaPor: string | null;
  anoEleicao: string | null;
  banidoEm: string | null;
  motivoBanimento: string | null;
  pautasAtivas: number;
};

// Saneamento do termo de busca. O operador ILIKE trata % e _ como curingas;
// sem tirar, alguém digitando "100%" casaria com qualquer coisa. Aqui vira
// literal — só as posições das palavras importam, que é o que se espera de
// uma busca por nome/apelido/e-mail.
function escaparCuringas(termo: string): string {
  return termo.replace(/[%_\\]/g, "\\$&");
}

/**
 * Busca pessoas por nome, apelido ou e-mail. Sem termo, devolve as mais
 * recentes — o inspetor que acabou de abrir a tela já vê gente em vez de vazio.
 *
 * O ILIKE é case-insensitive e o `OR` cobre os três campos. A cláusula
 * `WHERE lower(...) = lower(...)` do cadastro cria índices únicos em
 * lower(apelido) e lower(email), mas ILIKE com prefixo não os aproveita —
 * a busca é seq scan. Aceitável numa base pequena (campanha) e limitada a 20.
 */
export async function buscarUsuarios(termo: string): Promise<UsuarioLista[]> {
  const t = termo.trim();
  const linhas = t
    ? await sql`
        SELECT id, apelido, nome, email, papel, banido, perfil_completo, criado_em
        FROM users
        WHERE
          nome ILIKE ${`%${escaparCuringas(t)}%`}
          OR apelido ILIKE ${`%${escaparCuringas(t)}%`}
          OR email ILIKE ${`%${escaparCuringas(t)}%`}
        ORDER BY
          CASE WHEN apelido ILIKE ${`%${escaparCuringas(t)}%`} THEN 0 ELSE 1 END,
          criado_em DESC
        LIMIT 20
      `
    : await sql`
        SELECT id, apelido, nome, email, papel, banido, perfil_completo, criado_em
        FROM users
        ORDER BY criado_em DESC
        LIMIT 20
      `;

  return linhas.map((l) => ({
    id: l.id as number,
    apelido: l.apelido as string,
    nome: l.nome as string,
    email: l.email as string,
    papel: l.papel as Papel,
    banido: Boolean(l.banido),
    perfilCompleto: Boolean(l.perfil_completo),
    criadoEm: l.criado_em as string,
  }));
}

/**
 * Perfil completo de uma pessoa — o que o inspetor vê ao abrir a conta.
 * Junta dados de users com uma contagem de missões ativas (as que aquele
 * editor tem em mãos agora). Não traz portfólio/avaliações: a tela só precisa
 * saber QUEM é e se está ativo, não reproduzir o perfil público inteiro.
 */
export async function verDetalhesUsuario(userId: number): Promise<DetalheUsuario | null> {
  const [linha] = await sql`
    SELECT
      id, apelido, nome, email, papel, banido, perfil_completo, criado_em,
      foto_url, localizacao, bio,
      entregues, reputacao, streak, nota,
      cargo, disputa_por, ano_eleicao,
      banido_em, motivo_banimento
    FROM users
    WHERE id = ${userId}
  `;
  if (!linha) return null;

  // pautas "ativas" = em mãos agora (reservada/oferecida/reedicao/em_revisao),
  // não o histórico. Diz ao inspetor se tem trabalho pendente antes de banir.
  const [contagem] = await sql`
    SELECT count(*)::int AS total
    FROM pautas
    WHERE reservada_por_id = ${userId}
      AND status IN ('reservada','oferecida','reedicao','em_revisao')
  `;

  return {
    id: linha.id,
    apelido: linha.apelido,
    nome: linha.nome,
    email: linha.email,
    papel: linha.papel as Papel,
    banido: linha.banido,
    perfilCompleto: linha.perfil_completo,
    criadoEm: linha.criado_em,
    fotoUrl: linha.foto_url ?? null,
    localizacao: linha.localizacao ?? null,
    bio: linha.bio ?? null,
    entregues: linha.entregues ?? 0,
    reputacao: linha.reputacao ?? 0,
    streak: linha.streak ?? 0,
    nota: linha.nota === null ? null : Number(linha.nota),
    cargo: linha.cargo ?? null,
    disputaPor: linha.disputa_por ?? null,
    anoEleicao: linha.ano_eleicao ?? null,
    banidoEm: linha.banido_em ?? null,
    motivoBanimento: linha.motivo_banimento ?? null,
    pautasAtivas: contagem?.total ?? 0,
  };
}

/**
 * Bane uma conta. O efeito é triplo:
 *  1. `banido = true` — recusa login futuro (autenticar e Google).
 *  2. `sessoes_validas_apos = now()` — derruba a sessão atual na próxima
 *     chamada de lerSessao() (a checagem já existe desde sempre, era pra
 *     troca de senha; reuso de propósito).
 *  3. grava motivo e data — registro visível só ao inspetor.
 *
 * Admin não se bane e não bane outro admin: o guarda (`papel = 'admin'`)
 * impede os dois de uma vez. Sem ele, um clique distraído tirava o único
 * administrador da plataforma, e não há recovery por fluxo normal.
 */
export async function banirUsuario(
  userId: number,
  motivo: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) return { ok: false, erro: "Escreva o motivo do banimento." };
  if (motivoLimpo.length > 500) return { ok: false, erro: "Motivo longo demais (máx. 500)." };

  const [atualizada] = await sql`
    UPDATE users
    SET banido = true,
        banido_em = now(),
        motivo_banimento = ${motivoLimpo},
        sessoes_validas_apos = now()
    WHERE id = ${userId} AND papel <> 'admin'
    RETURNING id
  `;
  if (!atualizada) {
    return { ok: false, erro: "Não dá pra banir essa conta (admin ou inexistente)." };
  }
  return { ok: true };
}

/** Reverte o banimento. Não apaga o histórico (banido_em/motivo) de cara:
 *  seta banido=false e limpa os campos, que é o que a tela espera. */
export async function desbanirUsuario(
  userId: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const [atualizada] = await sql`
    UPDATE users
    SET banido = false,
        banido_em = null,
        motivo_banimento = null
    WHERE id = ${userId}
    RETURNING id
  `;
  if (!atualizada) return { ok: false, erro: "Conta não encontrada." };
  return { ok: true };
}

/**
 * Apaga a conta pra valer. Só o inspetor chama isto, e não tem volta.
 *
 * Diferente de `apagarConta` (lib/contas.ts), que é a pessoa apagando a
 * própria e por isso pede senha: aqui quem apaga é outro alguém, então a
 * autorização é o papel, conferido na rota.
 *
 * Duas travas, e as duas existem porque isto é irreversível:
 *
 *  - `papel <> 'admin'`: mesma regra do banimento. Sem ela, um inspetor apaga
 *    o outro — ou a si mesmo — e o sistema fica sem ninguém pra aprovar
 *    entrega, com o trabalho de todo mundo parado em "em revisão".
 *  - devolver a missão pra fila ANTES de apagar. O `ON DELETE SET NULL` do
 *    schema limpa o dono mas não mexe no status: a missão ficaria 'reservada'
 *    sem reservante, invisível pra fila e nunca mais despachada. Missão zumbi,
 *    e o porta-voz sem entender por que o vídeo dele parou. Foi assim que o
 *    bug apareceu da primeira vez, na exclusão da própria conta.
 *
 * 'em_revisao' fica de fora de propósito: o vídeo já foi entregue e está com o
 * inspetor. Devolver pra fila jogaria fora trabalho pronto.
 */
export async function removerUsuario(
  userId: number
): Promise<{ ok: true; apelido: string } | { ok: false; erro: string }> {
  const [alvo] = await sql`
    SELECT id, apelido, papel FROM users WHERE id = ${userId}
  `;
  if (!alvo) return { ok: false, erro: "Conta não encontrada." };
  if (alvo.papel === "admin") {
    return { ok: false, erro: "Conta de inspetor não pode ser apagada por aqui." };
  }

  await sql`
    UPDATE pautas
    SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL, reservada_em = NULL
    WHERE reservada_por_id = ${userId} AND status IN ('reservada','reedicao','oferecida')
  `;

  await sql`DELETE FROM users WHERE id = ${userId}`;
  return { ok: true, apelido: String(alvo.apelido) };
}
