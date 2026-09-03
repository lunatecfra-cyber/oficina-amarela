import type { D1DatabaseLike } from "../d1/types.ts";
import { legacyColumnOf, renamedTable } from "./legacy-names.ts";

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
  /** Nome da tabela na ORIGEM (PostgreSQL, português). O destino é `renamedTable(table)`. */
  table: string;
  /** De onde as linhas saem no PostgreSQL. Padrão: a tabela de mesmo nome. */
  source?: string;
  /** Colunas zeradas na primeira passada e preenchidas depois (auto-referência, em nome de ORIGEM). */
  deferredColumns?: string[];
};

/**
 * Nome da tabela no DESTINO (D1, inglês após a 0003). A origem em produção
 * NÃO foi renomeada — renomear coluna de um banco que atende a aplicação no
 * ar quebraria a aplicação no ar — então a tradução acontece aqui, na
 * passagem. Ver packages/db/src/migration/legacy-names.ts.
 */
export function targetTableName(legacyTable: string): string {
  return renamedTable(legacyTable);
}

/** Nome da coluna na origem (PT), dado o nome no destino (EN). */
export function sourceColumnName(legacyTable: string, targetColumn: string): string {
  return legacyColumnOf(legacyTable, targetColumn);
}

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
  // Conteúdo e acervo do usuário. Ficaram de fora do plano original: sem eles a
  // migração perde portfólio, conquistas, acervo de músicas e novidades
  // publicadas — em silêncio, porque a conferência só olhava o que o plano
  // listava. O teste de cobertura do plano existe para isso não voltar.
  { table: "portfolio" },
  { table: "conquistas" },
  { table: "musicas" },
  { table: "novidades" },
  { table: "gamificacao_regras" },
];

/**
 * Tabelas deliberadamente fora do plano, com o motivo.
 *
 * O teste de cobertura falha se uma tabela existir nos dois schemas e não
 * estiver nem aqui nem no plano.
 */
export const MIGRATION_EXCLUSIONS: Record<string, string> = {
  tentativas_login:
    "estado efêmero de limite de tentativas; recomeçar do zero é o comportamento correto",
  tarefas_periodicas:
    "trava de periodicidade por requisição; no D1 quem agenda é o Cron, e a tabela nem existe",
};

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

/** Colunas que a origem realmente tem. */
export async function sourceColumns(sql: SqlClient, table: string): Promise<Set<string>> {
  const rows = await sql(
    rawQuery(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${table}'`,
    ),
  );
  return new Set((rows as unknown as Array<{ column_name: string }>).map((r) => r.column_name));
}

export type ColumnGap = { table: string; missing: string[] };

/**
 * O que o destino espera e a origem não tem.
 *
 * O recorte de colunas vem do PRAGMA do D1, então basta a origem estar uma
 * migração atrás para o SELECT citar coluna que não existe — e a carga morria
 * no meio, com o erro cru do PostgreSQL ("column whatsapp does not exist") e
 * nenhuma pista de que faltava aplicar `supabase/migrations` na origem.
 *
 * Conferir antes de escrever qualquer linha é o que transforma isso num
 * recado acionável em vez de uma migração pela metade.
 */
export async function findColumnGaps(
  sql: SqlClient,
  db: D1DatabaseLike,
  plan: MigrationTable[] = MIGRATION_PLAN,
): Promise<ColumnGap[]> {
  const gaps: ColumnGap[] = [];
  for (const entry of plan) {
    const target = targetTableName(entry.table);
    const expected = await targetColumns(db, target);
    const available = await sourceColumns(sql, entry.source ?? entry.table);
    // O destino fala inglês, a origem fala português: cada coluna esperada é
    // traduzida de volta antes de procurar na origem. Sem isso, toda coluna
    // renomeada (handle, missions, ...) vira "lacuna" fantasma.
    const missing = expected.filter(
      (column) => !available.has(sourceColumnName(entry.table, column)),
    );
    if (missing.length) gaps.push({ table: entry.table, missing });
  }
  return gaps;
}

/**
 * PostgreSQL devolve Date, boolean e objeto; o SQLite guarda texto, inteiro e
 * número. A conversão fica num lugar só para as duas pontas concordarem sobre
 * o que é "a mesma linha" na hora de conferir.
 *
 * Datas chegam de dois jeitos: o driver devolve Date para TIMESTAMPTZ quando
 * está em modo nativo, mas devolve string ("2026-08-30 12:00:00+00") quando a
 * coluna vem de pooler (Supabase/Neon) ou de `SELECT *` com parsing desligado.
 * O D1 guarda ISO-8601 UTC ordenável — então toda string que parece data é
 * normalizada para ISO, em vez de entrar no formato com espaço do Postgres.
 */
const PG_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?\s*(Z|[+-]\d{2}:?\d{2})?$/;

export function toSqliteValue(value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const match = PG_DATETIME.exec(value.trim());
    if (match) {
      const [, y, mo, d, h, mi, s, frac = "", tz = "Z"] = match;
      const millis = `${frac}000`.slice(0, 3);
      const isoLike = `${y}-${mo}-${d}T${h}:${mi}:${s}.${millis}${tz === "Z" ? "Z" : tz.includes(":") ? tz : `${tz.slice(0, 3)}:${tz.slice(3)}`}`;
      const parsed = new Date(isoLike);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return value;
  }
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
 *
 * Tradução PT→EN: `columns` são os nomes no DESTINO (inglês, do PRAGMA do D1);
 * cada um é traduzido de volta para o nome na ORIGEM (português) na hora do
 * SELECT, e o INSERT escreve no nome em inglês. `deferredColumns` continuam
 * declaradas em português (vocabulário da origem) e são mapeadas aqui.
 */
async function loadTable(
  sql: SqlClient,
  db: D1DatabaseLike,
  plan: MigrationTable,
  options: {
    dryRun: boolean;
    batchSize: number;
    gaps?: ColumnGap[];
    onProgress?: (table: string, done: number, total: number) => void;
  },
): Promise<{ report: TableReport; deferred: Record<string, unknown>[] }> {
  const target = targetTableName(plan.table);
  const absent = new Set(options.gaps?.find((gap) => gap.table === plan.table)?.missing ?? []);
  // `absent` guarda nomes de DESTINO (o que findColumnGaps reporta).
  const targetCols = (await targetColumns(db, target)).filter((column) => !absent.has(column));
  const deferredLegacy = new Set(plan.deferredColumns ?? []);
  const deferredTargets = new Set(
    [...deferredLegacy].map((col) => {
      // deferredColumns vêm em PT; o INSERT/UPDATE fala EN. Mapeia achando o
      // nome novo cuja tradução de volta é a coluna declarada.
      for (const t of targetCols) {
        if (sourceColumnName(plan.table, t) === col) return t;
      }
      return col;
    }),
  );
  const insertTargets = targetCols.filter((column) => !deferredTargets.has(column));
  const source = plan.source ?? plan.table;

  // SELECT na origem em PT, com alias para o nome EN: a linha resultante já
  // fala o vocabulário do destino, e o resto do código não precisa traduzir.
  const selectList = targetCols
    .map(
      (targetCol) =>
        `${quoteIdentifier(sourceColumnName(plan.table, targetCol))} AS ${quoteIdentifier(targetCol)}`,
    )
    .join(", ");
  const rows = await sql(
    rawQuery(`SELECT ${selectList} FROM ${quoteIdentifier(source)} ORDER BY 1`),
  );

  const before = await countIn(db, target);
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

  const placeholders = `(${insertTargets.map(() => "?").join(", ")})`;
  const statement = `INSERT OR IGNORE INTO ${quoteIdentifier(target)} (${insertTargets
    .map(quoteIdentifier)
    .join(", ")}) VALUES ${placeholders}`;

  // Lote via db.batch() quando o destino oferece (Miniflare/D1 local): uma
  // ida ao banco por lote em vez de uma por linha. Destino remoto (wrangler)
  // não tem batch de verdade — o run() acumula e descarrega em arquivo — então
  // cai no caminho por linha, que é o que o acumulador espera.
  const batchFn = db.batch?.bind(db);
  const canBatch = typeof batchFn === "function" && options.batchSize > 1;
  for (let start = 0; start < rows.length; start += options.batchSize) {
    const batch = rows.slice(start, start + options.batchSize);
    if (canBatch && batchFn) {
      await batchFn(
        batch.map((row) =>
          db.prepare(statement).bind(...insertTargets.map((column) => toSqliteValue(row[column]))),
        ),
      );
    } else {
      for (const row of batch) {
        await db
          .prepare(statement)
          .bind(...insertTargets.map((column) => toSqliteValue(row[column])))
          .run();
      }
    }
    options.onProgress?.(plan.table, Math.min(start + batch.length, rows.length), rows.length);
  }

  const after = await countIn(db, target);
  return {
    report: {
      table: plan.table,
      source: rows.length,
      loaded: after - before,
      target: after,
      skipped: rows.length - (after - before),
    },
    deferred: deferredTargets.size ? rows : [],
  };
}

/** Segunda passada das colunas auto-referentes, agora que todos existem. */
async function applyDeferred(
  db: D1DatabaseLike,
  plan: MigrationTable,
  rows: Record<string, unknown>[],
): Promise<void> {
  const legacyColumns = plan.deferredColumns ?? [];
  if (legacyColumns.length === 0 || rows.length === 0) return;
  const target = targetTableName(plan.table);
  // Mapeia PT→EN para o UPDATE no destino.
  const targetCols = legacyColumns.map((legacy) => {
    for (const candidate of Object.keys(rows[0] ?? {})) {
      if (sourceColumnName(plan.table, candidate) === legacy) return candidate;
    }
    return legacy;
  });
  const assignments = targetCols.map((column) => `${quoteIdentifier(column)} = ?`).join(", ");
  for (const row of rows) {
    if (targetCols.every((column) => row[column] === null || row[column] === undefined)) continue;
    await db
      .prepare(`UPDATE ${quoteIdentifier(target)} SET ${assignments} WHERE id = ?`)
      .bind(...targetCols.map((column) => toSqliteValue(row[column])), toSqliteValue(row.id))
      .run();
  }
}

export type MigrateOptions = {
  dryRun?: boolean;
  batchSize?: number;
  plan?: MigrationTable[];
  /**
   * Carrega mesmo com coluna faltando na origem, deixando-a nula no destino.
   * Só para migrar de uma origem que nunca terá aquela coluna — por padrão a
   * carga para e manda aplicar as migrações na origem.
   */
  allowMissingColumns?: boolean;
  /** Chamado a cada lote para destinos remotos não parecerem travados. */
  onProgress?: (table: string, done: number, total: number) => void;
};

export async function migrateToD1(
  sql: SqlClient,
  db: D1DatabaseLike,
  options: MigrateOptions = {},
): Promise<MigrationReport> {
  const dryRun = options.dryRun ?? false;
  const batchSize = options.batchSize ?? 200;
  const plan = options.plan ?? MIGRATION_PLAN;

  const gaps = await findColumnGaps(sql, db, plan);
  if (gaps.length && !options.allowMissingColumns) {
    const detail = gaps.map(({ table, missing }) => `  ${table}: ${missing.join(", ")}`).join("\n");
    throw new Error(
      "A origem não tem colunas que o destino espera:\n" +
        `${detail}\n` +
        "Aplique supabase/migrations na origem antes de migrar, ou use " +
        "--aceitar-colunas-ausentes para carregá-las como nulas.",
    );
  }

  const tables: TableReport[] = [];
  const pending: Array<{ plan: MigrationTable; rows: Record<string, unknown>[] }> = [];

  for (const entry of plan) {
    const { report, deferred } = await loadTable(sql, db, entry, {
      dryRun,
      batchSize,
      gaps,
      onProgress: options.onProgress,
    });
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

  // O destino já fala inglês (0003): mission_id, approved_by, approved_at,
  // rating, comment. A origem continua em português — a tradução é aqui.
  const approvalsBefore = await countIn(db, "mission_approvals").catch(() => 0);
  for (const row of approvals) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO mission_approvals (
           mission_id, editor_id, approved_by, status_final, rating, comment, approved_at
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
  }
  // Destino remoto acumula escritas e reporta changes:0 por linha (ver
  // remote-d1.ts): a contagem honesta é antes-depois, com descarga forçada.
  await (db as { flush?: () => Promise<void> }).flush?.();
  const approvalsAfter = await countIn(db, "mission_approvals").catch(() => approvalsBefore);
  const approvalsLoaded = approvalsAfter - approvalsBefore;

  const redemptions = await sql(
    rawQuery(`SELECT c.token_hash, c.email, c.usado_em, u.apelido, u.nome, u.senha_hash,
            u.google_id, u.foto_url
     FROM convites_porta_voz c
     JOIN users u ON u.id = c.usado_por
     WHERE c.usado_em IS NOT NULL AND c.usado_por IS NOT NULL`),
  );

  let redemptionsLoaded = 0;
  const redemptionsBefore = await countIn(db, "invitation_redemptions").catch(() => 0);
  for (const row of redemptions) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO invitation_redemptions (
           token_hash, email, handle, name, password_hash, google_id, avatar_url,
           referral_code, redeemed_at
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
  }
  await (db as { flush?: () => Promise<void> }).flush?.();
  const redemptionsAfter = await countIn(db, "invitation_redemptions").catch(
    () => redemptionsBefore,
  );
  redemptionsLoaded = redemptionsAfter - redemptionsBefore;

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
