import type { Papel } from "@/lib/sessao";

export type Cabecalho = "porta-voz" | "editor" | "inspetor";

/** Rotas compartilhadas não devem transformar o papel da pessoa. */
export function cabecalhoParceiros(papel: Papel | null | undefined): Cabecalho {
  if (papel === "admin") return "inspetor";
  return papel === "voz" ? "porta-voz" : "editor";
}
