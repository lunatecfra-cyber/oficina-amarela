import type { MissionQueueFailure } from "@oficina/db/mission-queue";

/**
 * Tradução dos motivos da fila para o que o usuário lê.
 *
 * Duplica de propósito o mapa do apps/web enquanto as duas bordas HTTP existem;
 * some quando o Next parar de servir a rota diretamente. O texto precisa ser
 * idêntico nos dois lados.
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
