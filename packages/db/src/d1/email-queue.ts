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
            `INSERT INTO fila_emails (chave, destinatario, assunto, html)
             VALUES (?, ?, ?, ?)
             ON CONFLICT (chave) DO NOTHING
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
          `UPDATE fila_emails
           SET tentativas = tentativas + 1, processar_apos = ?
           WHERE id IN (
             SELECT id FROM fila_emails
             WHERE enviado_em IS NULL AND processar_apos <= ? AND tentativas < ?
             ORDER BY processar_apos
             LIMIT ?
           )
             AND enviado_em IS NULL
           RETURNING id, destinatario, assunto, html, tentativas`,
        )
        .bind(backoffIso(), nowIso(), maxAttempts, limit)
        .all<QueuedEmail>();
      return rows.results;
    },

    async markSent(id) {
      await db
        .prepare("UPDATE fila_emails SET enviado_em = ?, erro = NULL WHERE id = ?")
        .bind(nowIso(), id)
        .run();
    },

    async markFailed(id, error) {
      await db
        .prepare("UPDATE fila_emails SET erro = ? WHERE id = ?")
        .bind(error.slice(0, 500), id)
        .run();
    },
  };
}
