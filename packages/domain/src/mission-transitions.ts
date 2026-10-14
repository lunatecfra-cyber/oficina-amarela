export type MissionAction =
  | "reserve"
  | "cancel"
  | "deliver"
  | "approve"
  | "re_edit"
  | "revision"
  | "accept"
  | "adjust"
  | "message"
  | "report"
  | "reservar"
  | "cancelar"
  | "entregar"
  | "aprovar"
  | "reedicao"
  | "aceitar"
  | "ajuste"
  | "mensagem"
  | "denunciar";

export function canPerformAction(rawStatus: string, rawRole: string, rawAction: string): boolean {
  const action = rawAction.toLowerCase();
  const status = rawStatus.toLowerCase();
  const isSpokesperson = rawRole === "spokesperson" || rawRole === "voz";
  const isEditor = rawRole === "editor";
  const isInspector = rawRole === "inspector" || rawRole === "inspetor";
  const isAdmin = rawRole === "admin";

  if (
    action === "message" ||
    action === "report" ||
    action === "mensagem" ||
    action === "denunciar"
  )
    return true;

  if (action === "reserve" || action === "reservar") {
    return (isEditor || isAdmin) && (status === "available" || status === "disponivel");
  }
  if (
    action === "cancel" ||
    action === "cancelar" ||
    action === "deliver" ||
    action === "entregar"
  ) {
    return (
      (isEditor || isAdmin) &&
      (status === "reserved" ||
        status === "reservada" ||
        status === "revision_requested" ||
        status === "reedicao")
    );
  }
  if (action === "approve" || action === "aprovar") {
    return (
      (isAdmin || isInspector || isSpokesperson) &&
      (status === "in_review" || status === "em_revisao")
    );
  }
  if (action === "re_edit" || action === "revision" || action === "reedicao") {
    return (isAdmin || isInspector) && (status === "in_review" || status === "em_revisao");
  }
  if (action === "accept" || action === "aceitar") {
    return (isSpokesperson || isAdmin) && (status === "approved" || status === "aprovada");
  }
  if (action === "adjust" || action === "ajuste") {
    return (
      (isSpokesperson || isAdmin) &&
      (status === "in_review" ||
        status === "em_revisao" ||
        status === "approved" ||
        status === "aprovada")
    );
  }

  return false;
}
