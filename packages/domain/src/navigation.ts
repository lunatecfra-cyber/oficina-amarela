import type { Role } from "./roles.ts";

export type HeaderType = "spokesperson" | "editor" | "inspector";
export type Cabecalho = HeaderType;

export function partnersHeader(role: Role | null | undefined): HeaderType {
  if (role === "admin") return "inspector";
  return role === "spokesperson" ? "spokesperson" : "editor";
}

export function partnersReturnPath(role: Role | null | undefined) {
  if (role === "admin") return "/inspetor";
  if (role === "spokesperson") return "/porta-voz";
  if (role === "editor") return "/editor";
  return "/";
}
