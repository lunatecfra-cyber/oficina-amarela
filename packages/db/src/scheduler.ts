import { sql } from "./client.ts";

/**
 * Trava de periodicidade para trabalho global disparado por requisição.
 *
 * Varreduras como expirar ofertas e despachar missões precisam rodar "de vez em
 * quando", não "uma vez por requisição". Rodando por requisição, 1.000 editores
 * em poll de 15s produzem ~67 varreduras idênticas por segundo — o gargalo mais
 * caro do desenho atual.
 *
 * `claimPeriodicTask` devolve true para no máximo uma chamada por janela: um
 * único UPSERT condicional decide, sem lock explícito e sem depender de recurso
 * específico do PostgreSQL, então o mesmo desenho vale num Cron Trigger ou
 * consumidor de fila da Cloudflare depois.
 */
export async function claimPeriodicTask(name: string, intervalSeconds: number): Promise<boolean> {
  const rows = await sql`
    INSERT INTO tarefas_periodicas (nome, executada_em)
    VALUES (${name}, now())
    ON CONFLICT (nome) DO UPDATE SET executada_em = now()
    WHERE tarefas_periodicas.executada_em < now() - make_interval(secs => ${intervalSeconds})
    RETURNING nome
  `;
  return rows.length > 0;
}

/** Nomes das tarefas, num lugar só para não divergirem entre chamadas. */
export const QUEUE_SWEEP_TASK = "fila_ofertas";
