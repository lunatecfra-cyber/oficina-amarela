import { type DrainResult, drainEmailQueue, enqueueEmails } from "@oficina/db/email-queue";
import {
  buildPasswordRecoveryEmail,
  deliverEmail,
  type EmailContent,
  escapeHtml,
} from "./messages.ts";

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

/**
 * O nome vem do cadastro do usuário e o texto do inspetor. Os dois entram
 * escapados: era o único molde de e-mail que interpolava HTML cru, e um nome
 * com marcação quebraria a mensagem que a própria pessoa recebe.
 */
export async function queueBroadcastEmail(
  to: string,
  name: string,
  subject: string,
  message: string,
): Promise<void> {
  const minute = new Date().toISOString().slice(0, 16);
  await enqueueEmails([
    {
      key: `broadcast:${to.toLowerCase()}:${minute}`,
      to,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1c1c22;">
          <h1 style="font-size: 20px; color: #a9840e;">Oficina Amarela</h1>
          <p>Oi, ${escapeHtml(name)}.</p>
          <p>${escapeHtml(message)}</p>
          <p style="font-size: 12px; color: #888; margin-top: 28px; border-top: 1px solid #eee; padding-top: 12px;">
            Você recebe este comunicado da administração da Oficina Amarela.
          </p>
        </div>
      `,
    },
  ]);
}

/**
 * Enfileira o link de recuperação.
 *
 * Antes o envio era direto, dentro da requisição, e sem proteção: com o
 * provedor não configurado ele lançava, a rota respondia 500 para e-mail que
 * existe e 200 para e-mail que não existe — e isso enumerava conta, exatamente
 * o que a rota tenta impedir. Enfileirar é uma escrita no banco: não depende do
 * provedor estar de pé, e a resposta fica igual nos dois casos.
 *
 * A chave usa o minuto: pedir de novo dentro do minuto não manda dois e-mails.
 */
export async function queueRecoveryEmail(to: string, name: string, link: string): Promise<void> {
  const { subject, html } = buildPasswordRecoveryEmail(name, link);
  const minute = new Date().toISOString().slice(0, 16);
  await enqueueEmails([{ key: `recovery:${to.toLowerCase()}:${minute}`, to, subject, html }]);
}
