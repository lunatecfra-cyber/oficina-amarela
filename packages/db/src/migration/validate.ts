import type { D1DatabaseLike } from "../d1/types.ts";
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
};

/** Invariantes que o PostgreSQL guarda em índice único parcial. */
const BUSINESS_CHECKS: Array<{ name: string; table: string; query: string; detail: string }> = [
  {
    name: "convite_aberto_duplicado",
    table: "convites_porta_voz",
    query: `SELECT lower(email) AS chave, count(*) AS total FROM convites_porta_voz
            WHERE usado_em IS NULL AND revogado_em IS NULL
            GROUP BY lower(email) HAVING count(*) > 1`,
    detail: "e-mail com mais de um convite aberto",
  },
  {
    name: "missao_ativa_duplicada",
    table: "pautas",
    query: `SELECT reservada_por_id AS chave, count(*) AS total FROM pautas
            WHERE reservada_por_id IS NOT NULL
              AND status IN ('reservada', 'em_edicao', 'em_revisao', 'reedicao')
            GROUP BY reservada_por_id HAVING count(*) > 1`,
    detail: "editor com mais de uma missão ativa",
  },
  {
    name: "aprovacao_duplicada",
    table: "ranking_aprovacoes",
    query: `SELECT pauta_id AS chave, count(*) AS total FROM ranking_aprovacoes
            WHERE anulado_em IS NULL
            GROUP BY pauta_id HAVING count(*) > 1`,
    detail: "missão pontuada mais de uma vez no ranking",
  },
  {
    name: "indicacao_duplicada",
    table: "indicacoes_recompensas",
    query: `SELECT convidado_id AS chave, count(*) AS total FROM indicacoes_recompensas
            WHERE revogado_em IS NULL
            GROUP BY convidado_id HAVING count(*) > 1`,
    detail: "convidado premiado mais de uma vez",
  },
  {
    name: "evento_gamificacao_duplicado",
    table: "gamificacao_eventos",
    query: `SELECT user_id || '/' || regra_id || '/' || referencia AS chave, count(*) AS total
            FROM gamificacao_eventos
            GROUP BY user_id, regra_id, referencia HAVING count(*) > 1`,
    detail: "mesmo evento pontuado mais de uma vez",
  },
  {
    name: "bloqueios_acima_do_limite",
    table: "bloqueios_constancia",
    query: `SELECT editor_id AS chave, count(*) AS total FROM bloqueios_constancia
            WHERE consumido_em IS NULL
            GROUP BY editor_id HAVING count(*) > 2`,
    detail: "editor com mais bloqueios disponíveis do que o máximo de dois",
  },
  {
    name: "pontuacao_sem_aprovacao",
    table: "pautas",
    query: `SELECT p.id AS chave, 1 AS total FROM pautas p
            WHERE p.pontuada = 1
              AND NOT EXISTS (SELECT 1 FROM ranking_aprovacoes a WHERE a.pauta_id = p.id)`,
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

    const [expected, actual] = await Promise.all([
      sourceCount(sql, source),
      targetCount(db, table),
    ]);
    if (expected !== actual) {
      discrepancies.push({
        kind: "contagem",
        table,
        detail: `origem ${expected}, destino ${actual}`,
      });
    }

    const key = IDENTITY_KEYS[table];
    if (key) {
      const [fromSource, fromTarget] = await Promise.all([
        sourceIds(sql, source, key),
        targetIds(db, table, key),
      ]);
      const missing = [...fromSource].filter((id) => !fromTarget.has(id));
      const extra = [...fromTarget].filter((id) => !fromSource.has(id));
      if (missing.length) {
        discrepancies.push({
          kind: "ausente",
          table,
          detail: `${missing.length} ${key} não chegaram (ex.: ${sample(missing)})`,
        });
      }
      if (extra.length) {
        discrepancies.push({
          kind: "excedente",
          table,
          detail: `${extra.length} ${key} existem só no destino (ex.: ${sample(extra)})`,
        });
      }
    }

    // Colunas: o destino é um recorte, mas toda coluna dele precisa existir na
    // origem — se não existir, a carga estava copiando outra coisa.
    const columns = await targetColumns(db, table);
    const [sourceRow] = await sql(rawQuery(`SELECT * FROM "${source}" LIMIT 1`));
    if (sourceRow) {
      const absent = columns.filter((column) => !(column in sourceRow));
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
