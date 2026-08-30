import type { Role } from "./roles.ts";

export type HeaderType = "spokesperson" | "editor" | "inspector";
export type Cabecalho = HeaderType;

export function partnersHeader(role: Role | null | undefined): HeaderType {
  if (role === "admin") return "inspector";
  return role === "spokesperson" ? "spokesperson" : "editor";
}

export const partnersHeaderRole = partnersHeader;
export const cabecalhoParceiros = partnersHeader;
