import type { Role } from "@oficina/auth/session";
import { fetchApi, fetchApiJson } from "./internal-api.ts";

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

export async function isRateLocked(key: string): Promise<{ locked: boolean; minutes: number }> {
  const res = await fetchApi("/auth/rate-limit/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  });
  const data = (await res.json().catch(() => ({}))) as { locked?: boolean; minutes?: number };
  return { locked: Boolean(data.locked), minutes: Number(data.minutes ?? 0) };
}

export async function recordAttempt(
  key: string,
  max = 10,
  windowMinutes = 15,
  lockMinutes = 15,
): Promise<{ locked: boolean }> {
  const res = await fetchApi("/auth/rate-limit/record", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, max, windowMinutes, lockMinutes }),
  });
  const data = (await res.json().catch(() => ({}))) as { locked?: boolean };
  return { locked: Boolean(data.locked) };
}

export async function accountHasPassword(_userId?: number): Promise<boolean> {
  const data = await fetchApiJson<{ hasPassword: boolean }>("/account");
  return Boolean(data?.hasPassword);
}
