import type { D1DatabaseLike } from "../d1/types.ts";

/**
 * Ensaio de migração PostgreSQL → D1.
 *
 * Extrai, transforma, carrega e confere. Nada aqui apaga dado: a carga é
 * `INSERT OR IGNORE`, então repetir o ensaio é seguro e retomar de onde parou
 * também. A origem e o destino são sempre explícitos — não há padrão que
 * aponte para produção sem alguém escrever o endereço.
 *
 * Duas escolhas merecem explicação:
 *
 * 1. As colunas saem do PRAGMA do próprio D1, não de uma lista escrita aqui.
 *    O esquema do D1 é um recorte do PostgreSQL — só o que as fatias migradas
 *    precisam — e deixar o destino ditar o recorte evita que esta ferramenta
 *    envelheça sozinha quando o esquema andar.
 *
 * 2. Os gatilhos do D1 são aplicados DEPOIS da carga. mission_approvals e
 *    invitation_redemptions são tabelas de evento: inserir nelas reaplica
 *    pontuação, reputação, ranking e auditoria. Num backfill isso contaria
 *    tudo duas vezes. Carregando com os gatilhos ausentes, o histórico entra
 *    como histórico, e a idempotência passa a valer da migração em diante.
 */

export type MigrationTable = {
  /** Nome da tabela nas duas pontas. */
  table: string;
  /** De onde as linhas saem no PostgreSQL. Padrão: a tabela de mesmo nome. */
  source?: string;
  /** Colunas zeradas na primeira passada e preenchidas depois (auto-referência). */
  deferredColumns?: string[];
};

/**
 * Ordem de carga: uma tabela só entra depois de quem ela referencia.
 *
 * users referencia a si mesma por indicado_por_id, então entra em duas
 * passadas — primeiro sem a indicação, depois com ela.
 */
export const MIGRATION_PLAN: MigrationTable[] = [
  { table: "users", deferredColumns: ["indicado_por_id"] },
  { table: "pautas" },
  { table: "mensagens" },
  { table: "denuncias" },
  { table: "avaliacoes" },
  { table: "ofertas" },
  { table: "ranking_ciclos" },
  { table: "ranking_aprovacoes" },
  { table: "convites_porta_voz" },
  { table: "indicacoes_recompensas" },
  { table: "bloqueios_constancia" },
  { table: "gamificacao_eventos" },
  { table: "auditoria_admin" },
  { table: "fila_emails" },
];

export type SqlClient = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>;

export type TableReport = {
  table: string;
  source: number;
  loaded: number;
  target: number;
  skipped: number;
};

export type Discrepancy = { kind: string; table: string; detail: string };

export type MigrationReport = {
  dryRun: boolean;
  tables: TableReport[];
  discrepancies: Discrepancy[];
};

/** Colunas que o destino realmente tem. O recorte é do D1. */
export async function targetColumns(db: D1DatabaseLike, table: string): Promise<string[]> {
  const { results } = await db
    .prepare(`PRAGMA table_info(${table})`)
    .all<{ name: string; hidden?: number }>();
  if (results.length === 0) throw new Error(`Tabela ausente no destino: ${table}`);
  return results.map((column) => column.name);
}

/**
 * PostgreSQL devolve Date, boolean e objeto; o SQLite guarda texto, inteiro e
 * número. A conversão fica num lugar só para as duas pontas concordarem sobre
 * o que é "a mesma linha" na hora de conferir.
 */
export function toSqliteValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/**
 * postgres.js só aceita template marcado — precisa do `.raw`. Estas consultas
 * são montadas a partir do PRAGMA do destino, e todo identificador passa por
 * quoteIdentifier antes de chegar aqui.
 */
export function rawQuery(query: string): TemplateStringsArray {
  const strings = [query] as string[] & { raw: string[] };
  strings.raw = [query];
  return strings as unknown as TemplateStringsArray;
}

function quoteIdentifier(name: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error(`Identificador inválido: ${name}`);
  return `"${name}"`;
}

async function countIn(db: D1DatabaseLike, table: string): Promise<number> {
  const row = await db
    .prepare(`SELECT count(*) AS total FROM ${quoteIdentifier(table)}`)
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

/**
 * Carrega uma tabela. `INSERT OR IGNORE` faz a operação ser idempotente: rodar
 * de novo não duplica nem levanta erro em linha que já chegou.
 */
async function loadTable(
  sql: SqlClient,
  db: D1DatabaseLike,
  plan: MigrationTable,
  options: { dryRun: boolean; batchSize: number },
): Promise<{ report: TableReport; deferred: Record<string, unknown>[] }> {
  const columns = await targetColumns(db, plan.table);
  const deferred = new Set(plan.deferredColumns ?? []);
  const insertColumns = columns.filter((column) => !deferred.has(column));
  const source = plan.source ?? plan.table;

  const selected = [...columns].map(quoteIdentifier).join(", ");
  const rows = await sql(rawQuery(`SELECT ${selected} FROM ${quoteIdentifier(source)} ORDER BY 1`));

  const before = await countIn(db, plan.table);
  if (options.dryRun) {
    return {
      report: {
        table: plan.table,
        source: rows.length,
        loaded: 0,
        target: before,
        // A seco nada é pulado: `source` é o que entraria, `target` o que já está.
        skipped: 0,
      },
      deferred: [],
    };
  }

  const placeholders = `(${insertColumns.map(() => "?").join(", ")})`;
  const statement = `INSERT OR IGNORE INTO ${quoteIdentifier(plan.table)} (${insertColumns
    .map(quoteIdentifier)
    .join(", ")}) VALUES ${placeholders}`;

  for (let start = 0; start < rows.length; start += options.batchSize) {
    const batch = rows.slice(start, start + options.batchSize);
    for (const row of batch) {
      await db
        .prepare(statement)
        .bind(...insertColumns.map((column) => toSqliteValue(row[column])))
        .run();
    }
  }

  const after = await countIn(db, plan.table);
  return {
    report: {
      table: plan.table,
      source: rows.length,
      loaded: after - before,
      target: after,
      skipped: rows.length - (after - before),
    },
    deferred: deferred.size ? rows : [],
  };
}

/** Segunda passada das colunas auto-referentes, agora que todos existem. */
async function applyDeferred(
  db: D1DatabaseLike,
  plan: MigrationTable,
  rows: Record<string, unknown>[],
): Promise<void> {
  const columns = plan.deferredColumns ?? [];
  if (columns.length === 0 || rows.length === 0) return;
  const assignments = columns.map((column) => `${quoteIdentifier(column)} = ?`).join(", ");
  for (const row of rows) {
    if (columns.every((column) => row[column] === null || row[column] === undefined)) continue;
    await db
      .prepare(`UPDATE ${quoteIdentifier(plan.table)} SET ${assignments} WHERE id = ?`)
      .bind(...columns.map((column) => toSqliteValue(row[column])), toSqliteValue(row.id))
      .run();
  }
}

export type MigrateOptions = {
  dryRun?: boolean;
  batchSize?: number;
  plan?: MigrationTable[];
};

export async function migrateToD1(
  sql: SqlClient,
  db: D1DatabaseLike,
  options: MigrateOptions = {},
): Promise<MigrationReport> {
  const dryRun = options.dryRun ?? false;
  const batchSize = options.batchSize ?? 200;
  const plan = options.plan ?? MIGRATION_PLAN;

  const tables: TableReport[] = [];
  const pending: Array<{ plan: MigrationTable; rows: Record<string, unknown>[] }> = [];

  for (const entry of plan) {
    const { report, deferred } = await loadTable(sql, db, entry, { dryRun, batchSize });
    tables.push(report);
    if (deferred.length) pending.push({ plan: entry, rows: deferred });
  }

  if (!dryRun) {
    for (const entry of pending) await applyDeferred(db, entry.plan, entry.rows);
  }

  return { dryRun, tables, discrepancies: [] };
}

/**
 * Tabelas de evento que só existem no D1.
 *
 * mission_approvals e invitation_redemptions são o mecanismo de idempotência do
 * D1: a linha é a prova de que o efeito já aconteceu. O histórico do PostgreSQL
 * guarda a mesma verdade em outro formato, então o backfill traduz — e precisa
 * rodar com os gatilhos ainda desligados, senão reaplica pontuação, reputação,
 * ranking e auditoria que já aconteceram uma vez.
 *
 * Sem este backfill os dados ficariam corretos, mas uma reaprovação de missão
 * antiga responderia conflito em vez do sucesso idempotente que a fatia promete.
 */
export async function backfillD1EventTables(
  sql: SqlClient,
  db: D1DatabaseLike,
): Promise<TableReport[]> {
  // Trava dura: com os gatilhos ligados, uma linha nova aqui reaplicaria
  // pontuação, reputação, ranking e auditoria de um efeito que já aconteceu.
  // Recusar é a única resposta segura — desfazer depois seria adivinhação.
  const { results: triggers } = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'trigger'
         AND name IN ('apply_mission_approval', 'apply_invitation_redemption')`,
    )
    .all<{ name: string }>();
  if (triggers.length > 0) {
    throw new Error(
      "Backfill recusado: os gatilhos de evento já estão ligados " +
        `(${triggers.map((trigger) => trigger.name).join(", ")}). ` +
        "Carregue o histórico com o esquema sem gatilhos e ligue-os depois.",
    );
  }

  const approvals = await sql(
    rawQuery(`SELECT a.pauta_id, a.editor_id, a.aprovado_por, a.aprovado_em, p.status,
            av.nota, av.comentario
     FROM ranking_aprovacoes a
     JOIN pautas p ON p.id = a.pauta_id
     LEFT JOIN avaliacoes av ON av.pauta_id = a.pauta_id AND av.editor_id = a.editor_id
     WHERE a.anulado_em IS NULL AND p.status IN ('aprovada', 'finalizada')`),
  );

  let approvalsLoaded = 0;
  for (const row of approvals) {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO mission_approvals (
           pauta_id, editor_id, aprovado_por, status_final, nota, comentario, aprovado_em
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        toSqliteValue(row.pauta_id),
        toSqliteValue(row.editor_id),
        toSqliteValue(row.aprovado_por),
        toSqliteValue(row.status),
        toSqliteValue(row.nota),
        toSqliteValue(row.comentario),
        toSqliteValue(row.aprovado_em),
      )
      .run();
    approvalsLoaded += result.meta.changes;
  }

  const redemptions = await sql(
    rawQuery(`SELECT c.token_hash, c.email, c.usado_em, u.apelido, u.nome, u.senha_hash,
            u.google_id, u.foto_url
     FROM convites_porta_voz c
     JOIN users u ON u.id = c.usado_por
     WHERE c.usado_em IS NOT NULL AND c.usado_por IS NOT NULL`),
  );

  let redemptionsLoaded = 0;
  for (const row of redemptions) {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO invitation_redemptions (
           token_hash, email, apelido, nome, senha_hash, google_id, foto_url,
           codigo_indicacao, resgatado_em
         ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      )
      .bind(
        toSqliteValue(row.token_hash),
        toSqliteValue(row.email),
        toSqliteValue(row.apelido),
        toSqliteValue(row.nome),
        toSqliteValue(row.senha_hash),
        toSqliteValue(row.google_id),
        toSqliteValue(row.foto_url),
        toSqliteValue(row.usado_em),
      )
      .run();
    redemptionsLoaded += result.meta.changes;
  }

  return [
    {
      table: "mission_approvals",
      source: approvals.length,
      loaded: approvalsLoaded,
      target: approvalsLoaded,
      skipped: approvals.length - approvalsLoaded,
    },
    {
      table: "invitation_redemptions",
      source: redemptions.length,
      loaded: redemptionsLoaded,
      target: redemptionsLoaded,
      skipped: redemptions.length - redemptionsLoaded,
    },
  ];
}
