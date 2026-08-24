import type { Papel } from "@/lib/sessao";

export type Cabecalho = "porta-voz" | "editor";

/** Rotas compartilhadas não devem transformar o papel da pessoa. */
export function cabecalhoParceiros(papel: Papel | null | undefined): Cabecalho {
  return papel === "voz" || papel === "admin" ? "porta-voz" : "editor";
}
