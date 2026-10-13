import {
  type DrainResult,
  drainEmailQueue,
  enqueueEmails,
  pendingMissionNotifications,
} from "@oficina/db/email-queue";
import {
  buildApprovedDeliveryEmail,
  buildDeliveryReadyEmail,
  buildMissionUpdateEmail,
  buildPasswordRecoveryEmail,
  buildReEditRequestedEmail,
  deliverEmail,
  type EmailContent,
} from "./messages.ts";

let emailRuntime = { simulated: false, origin: "https://oficinaamarela.com.br" };
export function configureEmailRuntime(runtime: typeof emailRuntime) {
  emailRuntime = runtime;
}

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
  const runtime = emailRuntime;
  const events = await pendingMissionNotifications();
  await enqueueEmails(
    events.map((event) => {
      const url =
        event.role === "admin"
          ? `${runtime.origin}/inspetor`
          : event.role === "editor"
            ? `${runtime.origin}/editor`
            : `${runtime.origin}/porta-voz/missao/db-${event.missionId}`;
      const content =
        event.event === "submitted"
          ? buildDeliveryReadyEmail(event.name, event.title, url)
          : event.event === "revision"
            ? buildReEditRequestedEmail(event.name, event.title, event.notes ?? "", url)
            : event.event === "approved"
              ? buildApprovedDeliveryEmail(event.name, event.title, undefined, url)
              : buildMissionUpdateEmail(event.event, event.title, event.notes, url);
      return { key: event.key, to: event.recipient, ...content };
    }),
  );
  const result = await drainEmailQueue(
    (email) =>
      runtime.simulated
        ? Promise.resolve(/@[^@\s]+\.(?:invalid|test|local)$/i.test(email.destinatario))
        : deliverEmail(email.destinatario, email.assunto, email.html),
    BATCH,
    runtime.simulated ? "simulated" : "provider",
  );
  if (result.sent > 0 || result.failed > 0) {
    console.log(
      `[email] fila drenada: ${result.sent} ${runtime.simulated ? "simulados" : "enviados"}, ${result.failed} falharam`,
    );
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
  eventVersion?: string | number,
): Promise<void> {
  const minute = new Date().toISOString().slice(0, 16);
  await enqueueEmails([
    {
      key: `mission:${missionId}:${event}:${to.toLowerCase()}:${eventVersion ?? minute}`,
      to,
      subject: content.subject,
      html: content.html,
    },
  ]);
}

/**
 * Enfileira um aviso em massa disparado pelo inspetor.
 *
 * A chave usa o minuto pelo mesmo motivo do aviso de missão: clicar duas vezes
 * no botão dentro do minuto não manda dois e-mails para a mesma pessoa.
 */
export async function queueNoticeEmail(
  notice: string,
  to: string,
  content: EmailContent,
): Promise<void> {
  const minute = new Date().toISOString().slice(0, 16);
  await enqueueEmails([
    {
      key: `notice:${notice}:${to.toLowerCase()}:${minute}`,
      to,
      subject: content.subject,
      html: content.html,
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
