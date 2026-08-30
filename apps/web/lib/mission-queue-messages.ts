import type { MissionQueueFailure, QueueResult } from "@oficina/db/mission-queue";

/**
 * Tradução dos motivos da fila para o que o usuário lê.
 *
 * O repositório devolve motivo tipado, não texto: assim a implementação em D1
 * pode mapear SQLITE_CONSTRAINT_UNIQUE para o mesmo motivo sem que ninguém
 * precise aprender um segundo dialeto de erro. A mensagem em PT-BR é decisão de
 * produto e mora aqui, na borda HTTP.
 */
export const MISSION_QUEUE_MESSAGES: Record<MissionQueueFailure, string> = {
  already_holds_mission: "Você já tem uma missão em mãos.",
  mission_unavailable: "Essa missão não está mais disponível.",
  mission_not_held: "Essa missão não está com você.",
  offer_invalid: "Essa oferta não é mais válida.",
};

export function queueMessage(reason: MissionQueueFailure): string {
  return MISSION_QUEUE_MESSAGES[reason];
}

/** Formato antigo `{ ok, error, erro }`, ainda esperado pelas rotas de missão. */
export function toLegacyResult(
  result: QueueResult,
): { ok: true } | { ok: false; error: string; erro: string } {
  if (result.ok) return { ok: true };
  const message = queueMessage(result.reason);
  return { ok: false, error: message, erro: message };
}
