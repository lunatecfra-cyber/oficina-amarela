import { sql } from "./client.ts";

/**
 * Leitura do ranking eleitoral.
 *
 * A aritmética de semana saiu do SQL e foi para @oficina/domain/ranking-cycle:
 * o PostgreSQL fazia isso com generate_series, date_trunc, LEAST e
 * extract(epoch), e o SQLite não tem nenhum deles. Aqui só se busca aprovação e
 * bloqueio; quem agrupa por semana é o domínio, igual para os dois bancos.
 */

export type RankingCycle = {
  id: number;
  name: string;
  startsAt: string;
  endsAt: string;
  frozenAt: string | null;
  highestActiveCount: number;
};

export type RankingEntry = {
  id: number;
  handle: string;
  name: string;
  count: number;
  reachedAt: string | null;
};

export interface RankingRepository {
  /** Congela ciclos cujo fim já passou. Idempotente. */
  freezeExpiredCycles(): Promise<void>;
  currentCycle(): Promise<RankingCycle | null>;
  entriesForCycle(cycleId: number): Promise<RankingEntry[]>;
  /** Instantes de aprovação válidos no ciclo, para agrupar por semana. */
  approvalTimes(cycleId: number, editorId?: number): Promise<string[]>;
  availableShields(editorId: number): Promise<number>;
  consumedShieldWeeks(editorId: number): Promise<string[]>;
  /** Gasta um bloqueio na semana. False quando não havia saldo. */
  consumeShield(editorId: number, weekKey: string): Promise<boolean>;
  referralCode(editorId: number): Promise<string | null>;
  /** Guarda o maior número de ativos já visto no ciclo e devolve o valor. */
  raiseActiveMilestone(cycleId: number, activeCount: number): Promise<number>;
}

function toCycle(row: Record<string, unknown> | undefined): RankingCycle | null {
  if (!row) return null;
  return {
    id: Number(row.id),
    name: String(row.nome),
    startsAt: new Date(row.inicia_em as string).toISOString(),
    endsAt: new Date(row.termina_em as string).toISOString(),
    frozenAt: row.congelado_em ? new Date(row.congelado_em as string).toISOString() : null,
    highestActiveCount: Number(row.max_editores_ativos ?? 0),
  };
}

export const postgresRanking: RankingRepository = {
  async freezeExpiredCycles() {
    await sql`
      UPDATE ranking_ciclos SET congelado_em = termina_em
      WHERE congelado_em IS NULL AND termina_em < now()
    `;
  },

  async currentCycle() {
    const [row] = await sql`
      SELECT id, nome, inicia_em, termina_em, congelado_em, max_editores_ativos
      FROM ranking_ciclos ORDER BY inicia_em DESC LIMIT 1
    `;
    return toCycle(row as unknown as Record<string, unknown>);
  },

  async entriesForCycle(cycleId) {
    const rows = await sql`
      SELECT u.id, u.apelido, u.nome, count(a.pauta_id)::int AS quantidade,
             max(a.aprovado_em) AS atingiu_em
      FROM ranking_aprovacoes a
      JOIN users u ON u.id = a.editor_id
      WHERE a.anulado_em IS NULL AND a.ciclo_id = ${cycleId}
      GROUP BY u.id, u.apelido, u.nome
      ORDER BY quantidade DESC, atingiu_em ASC, u.id ASC
    `;
    return rows.map((row) => ({
      id: Number(row.id),
      handle: String(row.apelido),
      name: String(row.nome),
      count: Number(row.quantidade),
      reachedAt: row.atingiu_em ? new Date(row.atingiu_em as string).toISOString() : null,
    }));
  },

  async approvalTimes(cycleId, editorId) {
    const rows = editorId
      ? await sql`
          SELECT aprovado_em FROM ranking_aprovacoes
          WHERE anulado_em IS NULL AND ciclo_id = ${cycleId} AND editor_id = ${editorId}
        `
      : await sql`
          SELECT aprovado_em FROM ranking_aprovacoes
          WHERE anulado_em IS NULL AND ciclo_id = ${cycleId}
        `;
    return rows.map((row) => new Date(row.aprovado_em as string).toISOString());
  },

  async availableShields(editorId) {
    const [row] = await sql`
      SELECT count(*)::int AS total FROM bloqueios_constancia
      WHERE editor_id = ${editorId} AND consumido_em IS NULL
    `;
    return Number(row?.total ?? 0);
  },

  async consumedShieldWeeks(editorId) {
    const rows = await sql`
      SELECT consumido_semana FROM bloqueios_constancia
      WHERE editor_id = ${editorId} AND consumido_semana IS NOT NULL
    `;
    return rows.map((row) => String(row.consumido_semana).slice(0, 10));
  },

  async consumeShield(editorId, weekKey) {
    // Um bloqueio por semana: a condição de semana livre está na própria
    // instrução, então duas chamadas simultâneas não gastam dois.
    const [row] = await sql`
      UPDATE bloqueios_constancia SET consumido_em = now(), consumido_semana = ${weekKey}::date
      WHERE id = (
        SELECT b.id FROM bloqueios_constancia b
        WHERE b.editor_id = ${editorId} AND b.consumido_em IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM bloqueios_constancia usado
            WHERE usado.editor_id = ${editorId} AND usado.consumido_semana = ${weekKey}::date
          )
        ORDER BY b.concedido_em LIMIT 1
      )
      RETURNING id
    `;
    return Boolean(row);
  },

  async referralCode(editorId) {
    const [row] = await sql`SELECT codigo_indicacao::text FROM users WHERE id = ${editorId}`;
    return (row?.codigo_indicacao as string | null) ?? null;
  },

  async raiseActiveMilestone(cycleId, activeCount) {
    const [row] = await sql`
      UPDATE ranking_ciclos
      SET max_editores_ativos = GREATEST(max_editores_ativos, ${activeCount})
      WHERE id = ${cycleId}
      RETURNING max_editores_ativos
    `;
    return Number(row?.max_editores_ativos ?? activeCount);
  },
};
