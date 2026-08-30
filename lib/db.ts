import postgres from "postgres";

declare global {
  var __workshopSql: ReturnType<typeof postgres> | undefined;
}

function getClient() {
  if (globalThis.__workshopSql) return globalThis.__workshopSql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    // Next.js build evaluates modules at top-level; return stub proxy if no DB
    const stubClient = Object.assign(
      (...args: unknown[]) => {
        void args;
        return Promise.resolve([] as unknown[]);
      },
      {} as Record<PropertyKey, unknown>,
    );
    return new Proxy(stubClient, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => Promise.resolve([]);
      },
    }) as unknown as ReturnType<typeof postgres>;
  }

  // prepare: false is required for Supabase transaction pooler
  const client = postgres(url, { prepare: false });
  globalThis.__workshopSql = client;
  return client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  const client = getClient() as unknown as (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => postgres.PendingQuery<postgres.Row[]>;
  return client(strings, ...values);
}

sql.json = (value: unknown) => getClient().json(value as never);

/** Fecha o pool. Usado por testes e scripts pontuais; o app não chama. */
sql.end = () => getClient().end();

/** Nomes dos índices únicos que carregam invariantes de negócio (ver
 *  supabase/migrations/20260830_add_mission_concurrency_invariants.sql). */
export const ACTIVE_MISSION_PER_EDITOR_INDEX = "idx_pautas_missao_ativa_por_editor";
export const OFFER_PER_MISSION_EDITOR_INDEX = "idx_ofertas_missao_editor";

/**
 * Detecta violação de unicidade do PostgreSQL (SQLSTATE 23505), opcionalmente
 * de uma restrição específica. Em D1/SQLite o código muda para
 * SQLITE_CONSTRAINT_UNIQUE — ponto único de tradução quando a migração chegar.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; constraint_name?: unknown; constraint?: unknown };
  if (e.code !== "23505") return false;
  if (!constraint) return true;
  return e.constraint_name === constraint || e.constraint === constraint;
}
