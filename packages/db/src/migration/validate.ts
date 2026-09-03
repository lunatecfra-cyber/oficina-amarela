import type { D1DatabaseLike } from "../d1/types.ts";
import { legacyColumnOf, renamedTable } from "./legacy-names.ts";
import {
  type Discrepancy,
  MIGRATION_PLAN,
  rawQuery,
  type SqlClient,
  targetColumns,
} from "./pg-to-d1.ts";

/**
 * Conferência do ensaio de migração.
 *
 * Não basta a contagem bater: um dado pode chegar inteiro e ainda assim quebrar
 * uma invariante que o PostgreSQL segurava por índice único e o SQLite não.
 * Por isso a conferência tem quatro camadas — contagem, identidade, integridade
 * referencial e estado de negócio.
 *
 * Nenhuma delas escreve nada.
 */

const IDENTITY_KEYS: Record<string, string> = {
  // Chave de identidade na ORIGEM (português). O destino é traduzido via
  // legacyColumnOf na hora de ler — a conferência compara o mesmo conceito
  // nos dois vocabulários.
  users: "id",
  pautas: "id",
  mensagens: "id",
  denuncias: "id",
  avaliacoes: "id",
  ofertas: "id",
  ranking_ciclos: "id",
  ranking_aprovacoes: "pauta_id",
  convites_porta_voz: "id",
  indicacoes_recompensas: "convidado_id",
  bloqueios_constancia: "id",
  gamificacao_eventos: "id",
  auditoria_admin: "id",
  fila_emails: "id",
  portfolio: "id",
  conquistas: "id",
  musicas: "id",
  novidades: "id",
  gamificacao_regras: "id",
};

/** Invariantes que o PostgreSQL guarda em índice único parcial (vocabulário do D1, inglês). */
const BUSINESS_CHECKS: Array<{ name: string; table: string; query: string; detail: string }> = [
  {
    name: "convite_aberto_duplicado",
    table: "spokesperson_invitations",
    query: `SELECT lower(email) AS chave, count(*) AS total FROM spokesperson_invitations
            WHERE used_at IS NULL AND revoked_at IS NULL
            GROUP BY lower(email) HAVING count(*) > 1`,
    detail: "e-mail com mais de um convite aberto",
  },
  {
    name: "missao_ativa_duplicada",
    table: "missions",
    query: `SELECT reserved_by_id AS chave, count(*) AS total FROM missions
            WHERE reserved_by_id IS NOT NULL
              AND status IN ('reservada', 'em_edicao', 'em_revisao', 'reedicao')
            GROUP BY reserved_by_id HAVING count(*) > 1`,
    detail: "editor com mais de uma missão ativa",
  },
  {
    name: "aprovacao_duplicada",
    table: "ranking_approvals",
    query: `SELECT mission_id AS chave, count(*) AS total FROM ranking_approvals
            WHERE voided_at IS NULL
            GROUP BY mission_id HAVING count(*) > 1`,
    detail: "missão pontuada mais de uma vez no ranking",
  },
  {
    name: "indicacao_duplicada",
    table: "referral_rewards",
    query: `SELECT invitee_id AS chave, count(*) AS total FROM referral_rewards
            WHERE revoked_at IS NULL
            GROUP BY invitee_id HAVING count(*) > 1`,
    detail: "convidado premiado mais de uma vez",
  },
  {
    name: "evento_gamificacao_duplicado",
    table: "gamification_events",
    query: `SELECT user_id || '/' || rule_id || '/' || reference AS chave, count(*) AS total
            FROM gamification_events
            GROUP BY user_id, rule_id, reference HAVING count(*) > 1`,
    detail: "mesmo evento pontuado mais de uma vez",
  },
  {
    name: "bloqueios_acima_do_limite",
    table: "consistency_shields",
    query: `SELECT editor_id AS chave, count(*) AS total FROM consistency_shields
            WHERE consumed_at IS NULL
            GROUP BY editor_id HAVING count(*) > 2`,
    detail: "editor com mais bloqueios disponíveis do que o máximo de dois",
  },
  {
    name: "pontuacao_sem_aprovacao",
    table: "missions",
    query: `SELECT m.id AS chave, 1 AS total FROM missions m
            WHERE m.is_scored = 1
              AND NOT EXISTS (SELECT 1 FROM ranking_approvals a WHERE a.mission_id = m.id)`,
    detail: "missão marcada como pontuada sem aprovação no ranking",
  },
];

async function sourceCount(sql: SqlClient, table: string): Promise<number> {
  const [row] = await sql(rawQuery(`SELECT count(*)::int AS total FROM "${table}"`));
  return Number(row.total);
}

async function targetCount(db: D1DatabaseLike, table: string): Promise<number> {
  const row = await db
    .prepare(`SELECT count(*) AS total FROM "${table}"`)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

async function sourceIds(sql: SqlClient, table: string, key: string): Promise<Set<string>> {
  const rows = await sql(rawQuery(`SELECT "${key}" AS id FROM "${table}"`));
  return new Set(rows.map((row) => String(row.id)));
}

async function targetIds(db: D1DatabaseLike, table: string, key: string): Promise<Set<string>> {
  const { results } = await db
    .prepare(`SELECT "${key}" AS id FROM "${table}"`)
    .all<{ id: unknown }>();
  return new Set(results.map((row) => String(row.id)));
}

function sample(values: Iterable<string>, limit = 5): string {
  const taken = [...values].slice(0, limit);
  return taken.join(", ");
}

export async function validateMigration(
  sql: SqlClient,
  db: D1DatabaseLike,
  plan = MIGRATION_PLAN,
): Promise<Discrepancy[]> {
  const discrepancies: Discrepancy[] = [];

  for (const entry of plan) {
    const table = entry.table;
    const source = entry.source ?? table;
    const target = renamedTable(table);

    const [expected, actual] = await Promise.all([
      sourceCount(sql, source),
      targetCount(db, target),
    ]);
    if (expected !== actual) {
      discrepancies.push({
        kind: "contagem",
        table,
        detail: `origem ${expected}, destino ${actual}`,
      });
    }

    const legacyKey = IDENTITY_KEYS[table];
    if (legacyKey) {
      // A chave é declarada em PT (origem); o destino pode tê-la renomeada
      // (ex.: pauta_id → mission_id). Traduz antes de ler o D1.
      const destCols = await targetColumns(db, target);
      const targetKey =
        destCols.find((candidate) => legacyColumnOf(table, candidate) === legacyKey) ?? legacyKey;
      const [fromSource, fromTarget] = await Promise.all([
        sourceIds(sql, source, legacyKey),
        targetIds(db, target, targetKey),
      ]);
      const missing = [...fromSource].filter((id) => !fromTarget.has(id));
      const extra = [...fromTarget].filter((id) => !fromSource.has(id));
      if (missing.length) {
        discrepancies.push({
          kind: "ausente",
          table,
          detail: `${missing.length} ${legacyKey} não chegaram (ex.: ${sample(missing)})`,
        });
      }
      if (extra.length) {
        discrepancies.push({
          kind: "excedente",
          table,
          detail: `${extra.length} ${legacyKey} existem só no destino (ex.: ${sample(extra)})`,
        });
      }
    }

    // Colunas: o destino é um recorte, mas toda coluna dele precisa existir na
    // origem — traduzida de volta (EN→PT), senão toda coluna renomeada vira
    // falso positivo.
    const columns = await targetColumns(db, target);
    const [sourceRow] = await sql(rawQuery(`SELECT * FROM "${source}" LIMIT 1`));
    if (sourceRow) {
      const absent = columns.filter((column) => !(legacyColumnOf(table, column) in sourceRow));
      if (absent.length) {
        discrepancies.push({
          kind: "coluna",
          table,
          detail: `sem correspondência na origem: ${absent.join(", ")}`,
        });
      }
    }
  }

  // Integridade referencial do próprio SQLite.
  const { results: orphans } = await db
    .prepare("PRAGMA foreign_key_check")
    .all<{ table: string; rowid: number; parent: string }>();
  for (const orphan of orphans.slice(0, 20)) {
    discrepancies.push({
      kind: "referencia",
      table: String(orphan.table),
      detail: `linha ${orphan.rowid} aponta para ${orphan.parent} inexistente`,
    });
  }

  // Estado de negócio: invariantes que o PostgreSQL guarda em índice único.
  for (const check of BUSINESS_CHECKS) {
    const { results } = await db.prepare(check.query).all<{ chave: unknown; total: number }>();
    for (const row of results.slice(0, 10)) {
      discrepancies.push({
        kind: check.name,
        table: check.table,
        detail: `${check.detail} (chave ${String(row.chave)}, ${row.total}×)`,
      });
    }
  }

  return discrepancies;
}
