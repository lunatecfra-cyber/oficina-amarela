import { sql } from "./client.ts";

/**
 * Caixa de saída de e-mail.
 *
 * Enfileirar é barato e transacional; enviar é lento e falha. Separar os dois
 * tira o envio do caminho da requisição — que em ambiente serverless nem
 * terminava: promessa solta com `void` morre junto com a resposta.
 *
 * Contrato deliberadamente igual ao de uma fila da Cloudflare: chave de
 * idempotência, reivindicação com recuo, marca de envio. Na migração muda quem
 * dispara a drenagem, não o resto.
 */

/** Depois disso a mensagem para de ser tentada e fica registrada com o erro. */
export const MAX_ATTEMPTS = 5;

/** Recuo entre tentativas. Simples de propósito: e-mail não precisa de mais. */
const RETRY_BACKOFF_MINUTES = 5;

export type QueuedEmail = {
  id: number;
  recipient: string;
  subject: string;
  html: string;
  attempts: number;
  destinatario: string;
  assunto: string;
  tentativas: number;
};

export type EmailToQueue = {
  /** Estável para a mesma mensagem lógica: é ela que impede o envio duplicado. */
  key: string;
  to: string;
  subject: string;
  html: string;
};

/**
 * De onde a caixa de saída é lida e escrita.
 *
 * Existe pelo mesmo motivo de configureSessionRevocationSource: a drenagem
 * acontece no Cron e no consumidor de fila, longe do conjunto de repositórios
 * injetado nas rotas. Sem essa escolha, um Worker servido por D1 tenta drenar
 * e-mail contra um PostgreSQL que não existe — foi exatamente o que derrubou o
 * Cron do staging a cada minuto.
 */
export type EmailQueueSource = {
  enqueue(messages: EmailToQueue[]): Promise<number>;
  claim(limit: number): Promise<QueuedEmail[]>;
  markSent(id: number): Promise<void>;
  markFailed(id: number, error: string): Promise<void>;
};

let activeSource: EmailQueueSource | null = null;

/** `null` volta para o PostgreSQL. */
export function configureEmailQueueSource(source: EmailQueueSource | null): void {
  activeSource = source;
}

const postgresSource: EmailQueueSource = {
  enqueue: (messages) => postgresEnqueue(messages),
  claim: (limit) => claimPendingEmails(limit),
  markSent: (id) => markEmailSent(id),
  markFailed: (id, error) => markEmailFailed(id, error),
};

const source = (): EmailQueueSource => activeSource ?? postgresSource;

/** Enfileira ignorando repetição de chave. Devolve quantas mensagens são novas. */
export function enqueueEmails(messages: EmailToQueue[]): Promise<number> {
  return source().enqueue(messages);
}

async function postgresEnqueue(messages: EmailToQueue[]): Promise<number> {
  if (messages.length === 0) return 0;

  let queued = 0;
  for (const message of messages) {
    const rows = await sql`
      INSERT INTO fila_emails (chave, destinatario, assunto, html)
      VALUES (${message.key}, ${message.to}, ${message.subject}, ${message.html})
      ON CONFLICT (chave) DO NOTHING
      RETURNING id
    `;
    if (rows.length > 0) queued++;
  }
  return queued;
}

/**
 * Reivindica mensagens pendentes, já empurrando a próxima tentativa.
 *
 * O WHERE externo repete as condições da subconsulta de propósito: sob READ
 * COMMITTED, um segundo drenador que esbarre nas mesmas linhas as reavalia
 * depois do commit do primeiro e as descarta. É o que substitui
 * `FOR UPDATE SKIP LOCKED`, que não existe em D1.
 */
export async function claimPendingEmails(limit: number): Promise<QueuedEmail[]> {
  const rows = await sql`
    UPDATE fila_emails
    SET tentativas = tentativas + 1,
        processar_apos = now() + make_interval(mins => ${RETRY_BACKOFF_MINUTES})
    WHERE id IN (
      SELECT id FROM fila_emails
      WHERE enviado_em IS NULL
        AND processar_apos <= now()
        AND tentativas < ${MAX_ATTEMPTS}
      ORDER BY processar_apos
      LIMIT ${limit}
    )
      AND enviado_em IS NULL
      AND processar_apos <= now()
    RETURNING id, destinatario, assunto, html, tentativas
  `;
  return rows as unknown as QueuedEmail[];
}

export async function markEmailSent(id: number): Promise<void> {
  await sql`UPDATE fila_emails SET enviado_em = now(), erro = NULL WHERE id = ${id}`;
}

export async function markEmailFailed(id: number, error: string): Promise<void> {
  await sql`UPDATE fila_emails SET erro = ${error.slice(0, 500)} WHERE id = ${id}`;
}

export type DrainResult = { sent: number; failed: number };

/**
 * Drena até `limit` mensagens usando `send`. `send` precisa devolver true só
 * quando a entrega foi aceita pelo provedor.
 */
export async function drainEmailQueue(
  send: (email: QueuedEmail) => Promise<boolean>,
  limit = 50,
): Promise<DrainResult> {
  const queue = source();
  const claimed = await queue.claim(limit);
  let sent = 0;
  let failed = 0;

  for (const email of claimed) {
    try {
      if (await send(email)) {
        await queue.markSent(email.id);
        sent++;
      } else {
        await queue.markFailed(email.id, "provedor recusou a mensagem");
        failed++;
      }
    } catch (error) {
      await queue.markFailed(email.id, error instanceof Error ? error.message : String(error));
      failed++;
    }
  }

  return { sent, failed };
}
