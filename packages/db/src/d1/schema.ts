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

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  for (const statement of statements) {
    try {
      await db.prepare(statement).run();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/duplicate column name|no such column/i.test(msg)) {
        throw e;
      }
    }
  }
}

/** Só tabelas e índices: o destino aceita carga sem disparar efeito de evento. */
export async function applyD1Tables(db: D1DatabaseLike, schema: string): Promise<void> {
  await run(db, splitD1Schema(schema).tables);
}

/** Liga os gatilhos. Depois disto, todo evento novo aplica seus efeitos. */
export async function applyD1Triggers(db: D1DatabaseLike, schema: string): Promise<void> {
  await run(db, splitD1Schema(schema).triggers);
}

/** Nomes dos gatilhos declarados no esquema. */
export function d1TriggerNames(schema: string): string[] {
  return Array.from(
    splitD1Schema(schema)
      .triggers.join("\n")
      .matchAll(/CREATE TRIGGER(?: IF NOT EXISTS)? (\w+)/g),
    (match) => match[1],
  );
}

/**
 * Desliga os gatilhos de um destino que já tem o esquema inteiro.
 *
 * É o caso real da migração: o banco de produção é criado com o esquema
 * completo, e só depois recebe o histórico. Carregar com gatilho ligado
 * reaplicaria pontuação, reputação, ranking e auditoria de eventos que já
 * aconteceram uma vez.
 */
export async function dropD1Triggers(db: D1DatabaseLike, schema: string): Promise<number> {
  const names = d1TriggerNames(schema);
  for (const name of names) await db.prepare(`DROP TRIGGER IF EXISTS ${name}`).run();
  return names.length;
}

/** Esquema inteiro, na ordem. É o que os testes usam. */
export async function applyD1Schema(db: D1DatabaseLike, schema: string): Promise<void> {
  const { tables, triggers } = splitD1Schema(schema);
  await run(db, tables);
  await run(db, triggers);
}

/** Aplica todas as migrações D1 (0001, 0002, 0003) na ordem correta com tolerância a idempotência. */
export async function applyAllD1Migrations(db: D1DatabaseLike): Promise<void> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.resolve(here, "../../d1");
  const files = [
    "0001_mission_slice.sql",
    "0002_electoral_compliance.sql",
    "0003_rename_to_english.sql",
  ];
  for (const file of files) {
    const content = await readFile(path.join(migrationsDir, file), "utf8");
    await applyD1Schema(db, content);
  }
}
