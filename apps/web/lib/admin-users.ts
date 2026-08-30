import { invalidateSessionRevocation } from "@oficina/db/session-revocation";
import { sql } from "@/lib/db";
import type { Role } from "@/lib/session";

export type UserListItem = {
  id: number;
  handle: string;
  name: string;
  email: string;
  role: Role;
  isBanned: boolean;
  profileCompleted: boolean;
  createdAt: string;
  // aliases
  apelido?: string;
  nome?: string;
  papel?: Role;
  banido?: boolean;
  perfilCompleto?: boolean;
  criadoEm?: string;
};
export type UsuarioLista = UserListItem;

export type UserDetail = UserListItem & {
  avatarUrl: string | null;
  location: string | null;
  bio: string | null;
  deliveredCount: number;
  reputation: number;
  streak: number;
  rating: number | null;
  politicalOffice: string | null;
  runningFor: string | null;
  electionYear: string | null;
  bannedAt: string | null;
  banReason: string | null;
  activeMissions: number;
  // aliases
  fotoUrl?: string | null;
  localizacao?: string | null;
  entregues?: number;
  reputacao?: number;
  nota?: number | null;
  cargo?: string | null;
  disputaPor?: string | null;
  anoEleicao?: string | null;
  banidoEm?: string | null;
  motivoBanimento?: string | null;
  pautasAtivas?: number;
};
export type DetalheUsuario = UserDetail;

function escapeWildcards(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

function normalizeRoleFromDb(papel: string): Role {
  if (papel === "voz" || papel === "spokesperson") return "spokesperson";
  if (papel === "admin") return "admin";
  return "editor";
}

export async function searchUsers(term: string): Promise<UserListItem[]> {
  const t = term.trim();
  const rows = t
    ? await sql`
        SELECT id, apelido, nome, email, papel, banido, perfil_completo, criado_em
        FROM users
        WHERE
          nome ILIKE ${`%${escapeWildcards(t)}%`}
          OR apelido ILIKE ${`%${escapeWildcards(t)}%`}
          OR email ILIKE ${`%${escapeWildcards(t)}%`}
        ORDER BY
          CASE WHEN apelido ILIKE ${`%${escapeWildcards(t)}%`} THEN 0 ELSE 1 END,
          criado_em DESC
        LIMIT 20
      `
    : await sql`
        SELECT id, apelido, nome, email, papel, banido, perfil_completo, criado_em
        FROM users
        ORDER BY criado_em DESC
        LIMIT 20
      `;

  return rows.map((l) => {
    const role = normalizeRoleFromDb(l.papel as string);
    return {
      id: l.id as number,
      handle: l.apelido as string,
      name: l.nome as string,
      email: l.email as string,
      role,
      isBanned: Boolean(l.banido),
      profileCompleted: Boolean(l.perfil_completo),
      createdAt: l.criado_em as string,
      apelido: l.apelido as string,
      nome: l.nome as string,
      papel: role,
      banido: Boolean(l.banido),
      perfilCompleto: Boolean(l.perfil_completo),
      criadoEm: l.criado_em as string,
    };
  });
}

export const buscarUsuarios = searchUsers;

export async function viewUserDetails(userId: number): Promise<UserDetail | null> {
  const [row] = await sql`
    SELECT
      id, apelido, nome, email, papel, banido, perfil_completo, criado_em,
      foto_url, localizacao, bio,
      entregues, reputacao, streak, nota,
      cargo, disputa_por, ano_eleicao,
      banido_em, motivo_banimento
    FROM users
    WHERE id = ${userId}
  `;
  if (!row) return null;

  const [countRow] = await sql`
    SELECT count(*)::int AS total
    FROM pautas
    WHERE reservada_por_id = ${userId}
      AND status IN ('reservada','oferecida','reedicao','em_revisao')
  `;

  const role = normalizeRoleFromDb(row.papel as string);

  return {
    id: row.id,
    handle: row.apelido,
    name: row.nome,
    email: row.email,
    role,
    isBanned: Boolean(row.banido),
    profileCompleted: Boolean(row.perfil_completo),
    createdAt: row.criado_em,
    avatarUrl: row.foto_url ?? null,
    location: row.localizacao ?? null,
    bio: row.bio ?? null,
    deliveredCount: row.entregues ?? 0,
    reputation: row.reputacao ?? 0,
    streak: row.streak ?? 0,
    rating: row.nota === null ? null : Number(row.nota),
    politicalOffice: row.cargo ?? null,
    runningFor: row.disputa_por ?? null,
    electionYear: row.ano_eleicao ?? null,
    bannedAt: row.banido_em ?? null,
    banReason: row.motivo_banimento ?? null,
    activeMissions: countRow?.total ?? 0,
    // aliases
    apelido: row.apelido,
    nome: row.nome,
    papel: role,
    banido: Boolean(row.banido),
    perfilCompleto: Boolean(row.perfil_completo),
    criadoEm: row.criado_em,
    fotoUrl: row.foto_url ?? null,
    localizacao: row.localizacao ?? null,
    entregues: row.entregues ?? 0,
    reputacao: row.reputacao ?? 0,
    nota: row.nota === null ? null : Number(row.nota),
    cargo: row.cargo ?? null,
    disputaPor: row.disputa_por ?? null,
    anoEleicao: row.ano_eleicao ?? null,
    banidoEm: row.banido_em ?? null,
    motivoBanimento: row.motivo_banimento ?? null,
    pautasAtivas: countRow?.total ?? 0,
  };
}

export const verDetalhesUsuario = viewUserDetails;

export async function banUser(
  userId: number,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const cleanReason = reason.trim();
  if (!cleanReason)
    return {
      ok: false,
      error: "Escreva o motivo do banimento.",
      erro: "Escreva o motivo do banimento.",
    };
  if (cleanReason.length > 500)
    return {
      ok: false,
      error: "Motivo longo demais (máx. 500).",
      erro: "Motivo longo demais (máx. 500).",
    };

  const [updated] = await sql`
    UPDATE users
    SET banido = true,
        banido_em = now(),
        motivo_banimento = ${cleanReason},
        sessoes_validas_apos = now()
    WHERE id = ${userId} AND papel <> 'admin'
    RETURNING id
  `;
  if (updated) invalidateSessionRevocation(userId);
  if (!updated) {
    return {
      ok: false,
      error: "Não dá pra banir essa conta (admin ou inexistente).",
      erro: "Não dá pra banir essa conta (admin ou inexistente).",
    };
  }
  return { ok: true };
}

export const banirUsuario = banUser;

export async function unbanUser(
  userId: number,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const [updated] = await sql`
    UPDATE users
    SET banido = false,
        banido_em = null,
        motivo_banimento = null
    WHERE id = ${userId}
    RETURNING id
  `;
  if (!updated) return { ok: false, error: "Conta não encontrada.", erro: "Conta não encontrada." };
  return { ok: true };
}

export const desbanirUsuario = unbanUser;

export async function removeUser(
  userId: number,
): Promise<
  { ok: true; handle: string; apelido?: string } | { ok: false; error: string; erro?: string }
> {
  const [target] = await sql`
    SELECT id, apelido, papel FROM users WHERE id = ${userId}
  `;
  if (!target) return { ok: false, error: "Conta não encontrada.", erro: "Conta não encontrada." };
  if (target.papel === "admin") {
    return {
      ok: false,
      error: "Conta de inspetor não pode ser apagada por aqui.",
      erro: "Conta de inspetor não pode ser apagada por aqui.",
    };
  }

  await sql`
    UPDATE pautas
    SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL, reservada_em = NULL
    WHERE reservada_por_id = ${userId} AND status IN ('reservada','reedicao','oferecida')
  `;

  await sql`DELETE FROM users WHERE id = ${userId}`;
  return { ok: true, handle: String(target.apelido), apelido: String(target.apelido) };
}

export const removerUsuario = removeUser;
export const viewUserDetail = viewUserDetails;
