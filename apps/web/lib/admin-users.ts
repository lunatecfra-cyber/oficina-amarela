import type { UserDetail, UserListItem } from "@oficina/db/admin";
import { fetchApi, fetchApiJson } from "@/lib/internal-api";

export type { UserDetail, UserListItem };
export type UsuarioLista = UserListItem;
export type DetalheUsuario = UserDetail;

export async function searchUsers(term: string): Promise<UserListItem[]> {
  const users = await fetchApiJson<UserListItem[]>(`/admin/users?q=${encodeURIComponent(term)}`);
  return users ?? [];
}
export const buscarUsuarios = searchUsers;

export async function viewUserDetails(userId: number): Promise<UserDetail | null> {
  return fetchApiJson<UserDetail>(`/admin/users/${userId}`);
}
export const verDetalhesUsuario = viewUserDetails;
export const viewUserDetail = viewUserDetails;

export async function banUser(
  userId: number,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi(`/admin/users/${userId}/ban`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao banir usuário.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true };
}
export const banirUsuario = banUser;

export async function unbanUser(
  userId: number,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  const res = await fetchApi(`/admin/users/${userId}/unban`, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao desbanir usuário.";
    return { ok: false, error: err, erro: err };
  }
  return { ok: true };
}
export const desbanirUsuario = unbanUser;

export async function removeUser(
  userId: number,
): Promise<
  { ok: true; handle: string; apelido?: string } | { ok: false; error: string; erro?: string }
> {
  const res = await fetchApi(`/admin/users/${userId}`, { method: "DELETE" });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    handle?: string;
    apelido?: string;
    error?: string;
    erro?: string;
  };
  if (!res.ok || !body.ok) {
    const err = body.error ?? body.erro ?? "Erro ao remover usuário.";
    return { ok: false, error: err, erro: err };
  }
  return {
    ok: true,
    handle: body.handle ?? body.apelido ?? "",
    apelido: body.handle ?? body.apelido ?? "",
  };
}
export const removerUsuario = removeUser;
