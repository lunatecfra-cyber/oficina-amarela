import type { Role } from "./roles.ts";

export type HeaderType = "spokesperson" | "editor" | "inspector";
export type Cabecalho = HeaderType;

export function partnersHeader(
  role: Role | null | undefined,
  source?: Role | null,
): HeaderType {
  const effectiveRole = role ?? source;
  if (effectiveRole === "admin") return "inspector";
  return effectiveRole === "spokesperson" ? "spokesperson" : "editor";
}

export function partnersReturnPath(role: Role | null | undefined, source?: Role | null) {
  const effectiveRole = role ?? source;
  if (effectiveRole === "admin") return "/inspetor";
  if (effectiveRole === "spokesperson") return "/porta-voz";
  if (effectiveRole === "editor") return "/editor";
  return "/";
}
