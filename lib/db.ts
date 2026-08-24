import postgres from "postgres";

declare global {
  var __confrariaSql: ReturnType<typeof postgres> | undefined;
}

function obterClient() {
  if (globalThis.__confrariaSql) return globalThis.__confrariaSql;

  const url = process.env.DATABASE_URL;
  if (!url) {
    // Durante o build do Next.js (que avalia módulos no top-level) ou quando
    // não há banco configurado, retornamos um proxy burro que simula retornos vazios.
    const stubClient = Object.assign(
      (...args: unknown[]) => {
        void args;
        return Promise.resolve([] as unknown[]); // arrays vazios para não quebrar .map() ou destructuring
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

  // prepare:false é obrigatório com o pooler do Supabase em modo "transaction"
  const client = postgres(url, { prepare: false });
  globalThis.__confrariaSql = client;
  return client;
}

// wrapper de template literal — mesma ergonomia de `sql\`SELECT...\`` do
// postgres.js, mas conectando só na hora do uso
export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  const client = obterClient() as unknown as (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => postgres.PendingQuery<postgres.Row[]>;
  return client(strings, ...values);
}

/**
 * Marca um valor como JSONB. Precisa existir aqui porque `sql` é wrapper e
 * não carrega os helpers do postgres.js.
 *
 * Usar isto em vez de JSON.stringify(x) + ::jsonb — com a string, o Postgres
 * guarda um JSON *string* dentro do jsonb (duplamente codificado) e o valor
 * volta como texto em vez de objeto/array.
 */
sql.json = (valor: unknown) => obterClient().json(valor as never);
