import type { Role } from "@oficina/auth/session";
import { fetchApiJson } from "./internal-api.ts";

export type UserAccount = {
  id: number;
  handle: string;
  name: string;
  email: string;
  role: Role;
  apelido?: string;
  nome?: string;
  papel?: Role;
};
export type ContaUsuario = UserAccount;

export function isValidHandle(handle: string) {
  return /^[a-z0-9._]{3,24}$/i.test(handle.trim());
}

export async function accountHasPassword(_userId?: number): Promise<boolean> {
  const data = await fetchApiJson<{ hasPassword: boolean }>("/account");
  return Boolean(data?.hasPassword);
}
