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

export async function searchUsers(term: string): Promise<UserListItem[]> {
  const t = term.trim();
  const rows = t
    ? await sql`
        SELECT id, handle, name, email, role, is_banned, profile_completed, created_at
        FROM users
        WHERE
          name ILIKE ${`%${escapeWildcards(t)}%`}
          OR handle ILIKE ${`%${escapeWildcards(t)}%`}
          OR email ILIKE ${`%${escapeWildcards(t)}%`}
        ORDER BY
          CASE WHEN handle ILIKE ${`%${escapeWildcards(t)}%`} THEN 0 ELSE 1 END,
          created_at DESC
        LIMIT 20
      `
    : await sql`
        SELECT id, handle, name, email, role, is_banned, profile_completed, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 20
      `;

  return rows.map((l) => ({
    id: l.id as number,
    handle: l.handle as string,
    name: l.name as string,
    email: l.email as string,
    role: l.role as Role,
    isBanned: Boolean(l.is_banned),
    profileCompleted: Boolean(l.profile_completed),
    createdAt: l.created_at as string,
    apelido: l.handle as string,
    nome: l.name as string,
    papel: l.role as Role,
    banido: Boolean(l.is_banned),
    perfilCompleto: Boolean(l.profile_completed),
    criadoEm: l.created_at as string,
  }));
}

export const buscarUsuarios = searchUsers;

export async function viewUserDetails(userId: number): Promise<UserDetail | null> {
  const [row] = await sql`
    SELECT
      id, handle, name, email, role, is_banned, profile_completed, created_at,
      avatar_url, location, bio,
      delivered_count, reputation, streak, rating,
      political_office, running_for, election_year,
      banned_at, ban_reason
    FROM users
    WHERE id = ${userId}
  `;
  if (!row) return null;

  const [countRow] = await sql`
    SELECT count(*)::int AS total
    FROM missions
    WHERE reserved_by_id = ${userId}
      AND status IN ('reserved','offered','revision_requested','in_review')
  `;

  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    email: row.email,
    role: row.role as Role,
    isBanned: row.is_banned,
    profileCompleted: row.profile_completed,
    createdAt: row.created_at,
    avatarUrl: row.avatar_url ?? null,
    location: row.location ?? null,
    bio: row.bio ?? null,
    deliveredCount: row.delivered_count ?? 0,
    reputation: row.reputation ?? 0,
    streak: row.streak ?? 0,
    rating: row.rating === null ? null : Number(row.rating),
    politicalOffice: row.political_office ?? null,
    runningFor: row.running_for ?? null,
    electionYear: row.election_year ?? null,
    bannedAt: row.banned_at ?? null,
    banReason: row.ban_reason ?? null,
    activeMissions: countRow?.total ?? 0,
    // aliases
    apelido: row.handle,
    nome: row.name,
    papel: row.role as Role,
    banido: row.is_banned,
    perfilCompleto: row.profile_completed,
    criadoEm: row.created_at,
    fotoUrl: row.avatar_url ?? null,
    localizacao: row.location ?? null,
    entregues: row.delivered_count ?? 0,
    reputacao: row.reputation ?? 0,
    nota: row.rating === null ? null : Number(row.rating),
    cargo: row.political_office ?? null,
    disputaPor: row.running_for ?? null,
    anoEleicao: row.election_year ?? null,
    banidoEm: row.banned_at ?? null,
    motivoBanimento: row.ban_reason ?? null,
    pautasAtivas: countRow?.total ?? 0,
  };
}

export const verDetalhesUsuario = viewUserDetails;

export async function banUser(
  userId: number,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const cleanReason = reason.trim();
  if (!cleanReason) return { ok: false, error: "Please enter the reason for suspension.", erro: "Please enter the reason." };
  if (cleanReason.length > 500) return { ok: false, error: "Reason too long (max 500 characters).", erro: "Reason too long." };

  const [updated] = await sql`
    UPDATE users
    SET is_banned = true,
        banned_at = now(),
        ban_reason = ${cleanReason},
        valid_sessions_after = now()
    WHERE id = ${userId} AND role <> 'admin'
    RETURNING id
  `;
  if (!updated) {
    return { ok: false, error: "Cannot suspend this account (admin or non-existent).", erro: "Cannot suspend account." };
  }
  return { ok: true };
}

export const banirUsuario = banUser;

export async function unbanUser(
  userId: number
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const [updated] = await sql`
    UPDATE users
    SET is_banned = false,
        banned_at = null,
        ban_reason = null
    WHERE id = ${userId}
    RETURNING id
  `;
  if (!updated) return { ok: false, error: "Account not found.", erro: "Account not found." };
  return { ok: true };
}

export const desbanirUsuario = unbanUser;

export async function removeUser(
  userId: number
): Promise<{ ok: true; handle: string; apelido?: string } | { ok: false; error: string; erro?: string }> {
  const [target] = await sql`
    SELECT id, handle, role FROM users WHERE id = ${userId}
  `;
  if (!target) return { ok: false, error: "Account not found.", erro: "Account not found." };
  if (target.role === "admin") {
    return { ok: false, error: "Admin accounts cannot be deleted here.", erro: "Admin accounts cannot be deleted." };
  }

  await sql`
    UPDATE missions
    SET status = 'available', reserved_by_id = NULL, reserved_at = NULL
    WHERE reserved_by_id = ${userId} AND status IN ('reserved','revision_requested','offered')
  `;

  await sql`DELETE FROM users WHERE id = ${userId}`;
  return { ok: true, handle: String(target.handle), apelido: String(target.handle) };
}

export const removerUsuario = removeUser;

export const viewUserDetail = viewUserDetails;
