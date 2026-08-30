import { type DrainResult, drainEmailQueue, enqueueEmails } from "@oficina/db/email-queue";
import { deliverEmail, type EmailContent } from "@/lib/email";

/**
 * Liga a caixa de saída ao provedor de e-mail.
 *
 * Módulo separado só para não criar ciclo entre lib/email.ts (que monta e
 * entrega) e @oficina/db/email-queue (que guarda). É este ponto que vira o
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

/**
 * Enfileira um aviso de missão e agenda a drenagem para depois da resposta.
 *
 * A chave usa o minuto: repetir a mesma ação dentro do minuto não manda dois
 * e-mails, e uma reentrega legítima mais tarde manda.
 */
export async function queueMissionNotification(
  event: string,
  missionId: number,
  to: string,
  content: EmailContent,
): Promise<void> {
  const minute = new Date().toISOString().slice(0, 16);
  await enqueueEmails([
    {
      key: `mission:${missionId}:${event}:${to.toLowerCase()}:${minute}`,
      to,
      subject: content.subject,
      html: content.html,
    },
  ]);
}
