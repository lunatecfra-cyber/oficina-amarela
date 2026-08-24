export type PapelPauta = "voz" | "editor" | "admin";
export type StatusPauta =
  | "disponivel"
  | "oferecida"
  | "reservada"
  | "em_revisao"
  | "reedicao"
  | "aprovada"
  | "finalizada";

export type AcaoPauta =
  | "reservar"
  | "cancelar"
  | "entregar"
  | "aprovar"
  | "reedicao"
  | "aceitar"
  | "ajuste"
  | "mensagem"
  | "denunciar";

/** Guarda barata antes das queries de transição; ownership continua no SQL. */
export function podeExecutarAcao(
  status: string,
  papel: PapelPauta,
  acao: string,
): boolean {
  if (acao === "mensagem" || acao === "denunciar") return true;

  if (acao === "reservar") return papel !== "voz" && status === "disponivel";
  if (acao === "cancelar" || acao === "entregar") {
    return papel !== "voz" && (status === "reservada" || status === "reedicao");
  }
  if (acao === "aprovar") {
    return (papel === "admin" || papel === "voz") && status === "em_revisao";
  }
  if (acao === "reedicao") return papel === "admin" && status === "em_revisao";
  if (acao === "aceitar") return papel !== "editor" && status === "aprovada";
  if (acao === "ajuste") {
    return papel !== "editor" && (status === "em_revisao" || status === "aprovada");
  }

  return false;
}
