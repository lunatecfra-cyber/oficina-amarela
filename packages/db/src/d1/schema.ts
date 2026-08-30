import type { D1DatabaseLike } from "./types.ts";

/**
 * Aplicação do esquema D1.
 *
 * O D1 executa uma instrução por chamada, então o arquivo precisa ser fatiado.
 * Gatilho é o caso especial: tem `;` no meio do corpo e só termina no `END;`.
 *
 * A separação entre tabelas e gatilhos não é enfeite. Os gatilhos do D1 são o
 * mecanismo que aplica pontuação, reputação, ranking e auditoria quando um
 * evento nasce. Num backfill de histórico isso reaplicaria tudo — por isso a
 * migração cria as tabelas, carrega o passado e só então liga os gatilhos.
 */

export type D1SchemaParts = { tables: string[]; triggers: string[] };

export function splitD1Schema(schema: string): D1SchemaParts {
  const tables: string[] = [];
  const triggers: string[] = [];
  let statement = "";
  let inTrigger = false;

  for (const line of schema.replace(/^--.*$/gm, "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("CREATE TRIGGER")) inTrigger = true;
    statement += `${line}\n`;

    if ((!inTrigger && trimmed.endsWith(";")) || (inTrigger && trimmed === "END;")) {
      (inTrigger ? triggers : tables).push(statement);
      statement = "";
      inTrigger = false;
    }
  }

  if (statement.trim()) throw new Error("Instrução de esquema D1 incompleta");
  return { tables, triggers };
}

async function run(db: D1DatabaseLike, statements: string[]): Promise<void> {
  for (const statement of statements) await db.prepare(statement).run();
}

/** Só tabelas e índices: o destino aceita carga sem disparar efeito de evento. */
export async function applyD1Tables(db: D1DatabaseLike, schema: string): Promise<void> {
  await run(db, splitD1Schema(schema).tables);
}

/** Liga os gatilhos. Depois disto, todo evento novo aplica seus efeitos. */
export async function applyD1Triggers(db: D1DatabaseLike, schema: string): Promise<void> {
  await run(db, splitD1Schema(schema).triggers);
}

/** Esquema inteiro, na ordem. É o que os testes usam. */
export async function applyD1Schema(db: D1DatabaseLike, schema: string): Promise<void> {
  const { tables, triggers } = splitD1Schema(schema);
  await run(db, tables);
  await run(db, triggers);
}
