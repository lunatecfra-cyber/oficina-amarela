import type { EmailQueueSource, QueuedEmail } from "../email-queue.ts";
import type { D1DatabaseLike } from "./types.ts";

/**
 * Paridade D1 da caixa de saída de e-mail.
 *
 * Mesmo contrato do PostgreSQL: chave de idempotência, reivindicação com recuo
 * e marca de envio. As diferenças são de dialeto — o tempo é texto ISO em vez
 * de timestamptz, e a reivindicação usa a mesma repetição de condições no WHERE
 * externo, que aqui vale como defesa e não como necessidade (o D1 serializa).
 */
const RETRY_BACKOFF_MINUTES = 5;

const nowIso = () => new Date().toISOString();
const backoffIso = () => new Date(Date.now() + RETRY_BACKOFF_MINUTES * 60_000).toISOString();

export function createD1EmailQueueSource(
  db: D1DatabaseLike,
  maxAttempts: number,
): EmailQueueSource {
  return {
    async enqueue(messages) {
      let queued = 0;
      for (const message of messages) {
        const result = await db
          .prepare(
            `INSERT INTO email_queue (key, recipient, subject, html)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (key) DO NOTHING
             RETURNING id`,
          )
          .bind(message.key, message.to, message.subject, message.html)
          .first<{ id: number }>();
        if (result) queued++;
      }
      return queued;
    },

    async claim(limit) {
      const rows = await db
        .prepare(
          `UPDATE email_queue
           SET attempts = attempts + 1, process_after = ?
           WHERE id IN (
             SELECT id FROM email_queue
             WHERE sent_at IS NULL AND process_after <= ? AND attempts < ?
             ORDER BY process_after
             LIMIT ?
           )
             AND sent_at IS NULL
           RETURNING id, recipient, subject, html, attempts`,
        )
        .bind(backoffIso(), nowIso(), maxAttempts, limit)
        .all<{
          id: number;
          recipient: string;
          subject: string;
          html: string;
          attempts: number;
        }>();
      return rows.results.map((r) => ({
        id: r.id,
        recipient: r.recipient,
        subject: r.subject,
        html: r.html,
        attempts: r.attempts,
        destinatario: r.recipient,
        assunto: r.subject,
        tentativas: r.attempts,
      }));
    },

    async markSent(id) {
      await db
        .prepare("UPDATE email_queue SET sent_at = ?, error = NULL WHERE id = ?")
        .bind(nowIso(), id)
        .run();
    },

    async markFailed(id, error) {
      await db
        .prepare("UPDATE email_queue SET error = ? WHERE id = ?")
        .bind(error.slice(0, 500), id)
        .run();
    },
  };
}
