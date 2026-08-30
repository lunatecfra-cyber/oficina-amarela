import { deliverEmail } from "@/lib/email";
import { type DrainResult, drainEmailQueue } from "@/lib/email-queue-db";

/**
 * Liga a caixa de saída ao provedor de e-mail.
 *
 * Módulo separado só para não criar ciclo entre lib/email.ts (que monta e
 * entrega) e lib/email-queue-db.ts (que guarda). É este ponto que vira o
 * consumidor de Cloudflare Queue depois — o resto não muda.
 */

/** Teto por drenagem: mantém a rodada dentro do orçamento de CPU do Worker. */
const BATCH = 25;

export async function drainEmailQueueNow(): Promise<DrainResult> {
  const result = await drainEmailQueue(
    (email) => deliverEmail(email.destinatario, email.assunto, email.html),
    BATCH,
  );
  if (result.sent > 0 || result.failed > 0) {
    console.log(`[email] fila drenada: ${result.sent} enviados, ${result.failed} falharam`);
  }
  return result;
}
