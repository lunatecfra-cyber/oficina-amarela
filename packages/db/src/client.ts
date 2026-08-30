import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

declare global {
  var __workshopSql: ReturnType<typeof postgres> | undefined;
  var __workshopSqlUrl: string | undefined;
}

const NEXT_BUILD_PHASE = "phase-production-build";
let boundDatabaseUrl: string | undefined;

/** Configure the connection URL supplied by a Worker binding such as Hyperdrive. */
export function configureDatabaseUrl(url: string): void {
  if (!/^postgres(?:ql)?:\/\//.test(url)) {
    throw new Error("The database binding did not provide a PostgreSQL connection string.");
  }
  const currentUrl = globalThis.__workshopSqlUrl ?? boundDatabaseUrl;
  if (currentUrl && currentUrl !== url) {
    throw new Error("The database connection cannot change after this Worker isolate starts.");
  }
  boundDatabaseUrl = url;
}

/**
 * Why an empty-result stub is acceptable right now, or null when it is not.
 *
 * `next build` statically generates pages that query the database, so the build
 * has to survive without one. Anywhere else, a missing DATABASE_URL used to look
 * like a healthy but empty database — empty rankings, no missions, "user not
 * found" logins — which is the exact failure a misconfigured deploy produces.
 */
function stubReason(): string | null {
  if (process.env.NEXT_PHASE === NEXT_BUILD_PHASE) return "next build (static generation)";
  if (process.env.NODE_ENV !== "production" && process.env.DATABASE_STUB === "1") {
    return "DATABASE_STUB=1 (development only)";
  }
  return null;
}

let stubWarned = false;

function createStubClient(reason: string) {
  if (!stubWarned) {
    stubWarned = true;
    console.warn(
      `[db] DATABASE_URL not set — every query resolves to an empty result. Allowed here: ${reason}.`,
    );
  }

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

/**
 * Cliente com escopo de requisição, para os Workers.
 *
 * No workerd um socket aberto durante uma requisição não pode ser usado na
 * seguinte: o runtime responde "Cannot perform I/O on behalf of a different
 * request". Guardar o cliente numa global — que é o certo no Node — faz a
 * primeira requisição do isolate funcionar e todas as outras falharem.
 *
 * A recomendação da Cloudflare é criar um cliente por requisição e deixar o
 * Hyperdrive cuidar do pool, que é onde o custo de TCP/TLS realmente mora.
 * Aqui isso vira um escopo: dentro dele `sql` usa o cliente da requisição;
 * fora dele — Node, testes, `next build` — nada muda.
 */
const requestScopedClient = new AsyncLocalStorage<ReturnType<typeof postgres>>();

function newClient(url: string) {
  // prepare: false is required for the transaction pooler
  return postgres(url, { prepare: false, idle_timeout: 1 });
}

/**
 * Roda a requisição com um cliente próprio e o encerra ao final.
 *
 * Sem URL configurada segue o caminho normal, que já sabe decidir entre stub e
 * erro alto. O encerramento não é aguardado: a resposta desta API é sempre JSON
 * já materializado, e esperar o fechamento só somaria latência.
 */
export async function withRequestDatabase<T>(run: () => Promise<T>): Promise<T> {
  const url = boundDatabaseUrl ?? process.env.DATABASE_URL;
  if (!url) return run();

  // No Node.js / ambiente de testes sem Hyperdrive, o pool global gerencia
  // as conexões sem criar um cliente novo por requisição (evita esgotamento de conexões).
  if (!boundDatabaseUrl && typeof navigator === "undefined") {
    return run();
  }

  const client = newClient(url);
  try {
    return await requestScopedClient.run(client, run);
  } finally {
    void Promise.resolve(client.end({ timeout: 5 })).catch(() => {});
  }
}

function getClient() {
  const scoped = requestScopedClient.getStore();
  if (scoped) return scoped;

  const url = boundDatabaseUrl ?? process.env.DATABASE_URL;
  if (globalThis.__workshopSql) {
    if (url && globalThis.__workshopSqlUrl && globalThis.__workshopSqlUrl !== url) {
      throw new Error("The database connection cannot change after the client is initialized.");
    }
    return globalThis.__workshopSql;
  }

  if (!url) {
    const reason = stubReason();
    if (!reason) {
      throw new Error(
        "DATABASE_URL not configured. Set it in the environment (.env.local locally, " +
          "Wrangler secrets / hosting env in production). For a database-less local run, " +
          "set DATABASE_STUB=1 — it is refused when NODE_ENV=production.",
      );
    }
    // Not cached on globalThis: the stub must never outlive the phase that allowed it.
    return createStubClient(reason);
  }

  const client = newClient(url);
  globalThis.__workshopSql = client;
  globalThis.__workshopSqlUrl = url;
  return client;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  const client = getClient() as unknown as (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => postgres.PendingQuery<postgres.Row[]>;
  return client(strings, ...values);
}

export type TransactionSql = typeof sql;

export function withTransaction<T>(callback: (transaction: TransactionSql) => Promise<T>) {
  return getClient().begin((transaction) =>
    callback(transaction as unknown as TransactionSql),
  ) as Promise<T>;
}

sql.json = (value: unknown) => getClient().json(value as never);

/** Fecha o pool. Usado por testes e scripts pontuais; o app não chama. */
sql.end = () => getClient().end();

/** Nomes dos índices únicos que carregam invariantes de negócio (ver
 *  supabase/migrations/20260830_add_mission_concurrency_invariants.sql). */
export const ACTIVE_MISSION_PER_EDITOR_INDEX = "idx_pautas_missao_ativa_por_editor";
export const OFFER_PER_MISSION_EDITOR_INDEX = "idx_ofertas_missao_editor";
export const LIVE_OFFER_PER_MISSION_INDEX = "idx_ofertas_pendente_por_missao";
export const LIVE_OFFER_PER_EDITOR_INDEX = "idx_ofertas_pendente_por_editor";

/** Toda invariante de unicidade da tabela de ofertas. */
export const OFFER_UNIQUE_INDEXES = [
  OFFER_PER_MISSION_EDITOR_INDEX,
  LIVE_OFFER_PER_MISSION_INDEX,
  LIVE_OFFER_PER_EDITOR_INDEX,
];

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
