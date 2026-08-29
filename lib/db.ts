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
        return function() { return Promise.resolve([]); };
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
