import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { D1DatabaseLike, D1PreparedStatementLike } from "../d1/types.ts";

const run = promisify(execFile);

/**
 * Destino remoto do ensaio: um D1 de verdade, pelo wrangler.
 *
 * A migração escreve uma linha por vez (`prepare().bind().run()`). Contra um D1
 * remoto isso seria uma invocação de CLI por linha — inviável. Aqui a escrita é
 * acumulada e descarregada em lote, num arquivo .sql único por descarga.
 *
 * A leitura força a descarga antes de consultar. Sem isso, o `countIn` que a
 * migração faz depois de carregar leria um número velho e o relatório mentiria.
 *
 * Os valores entram como literais porque `d1 execute --file` não aceita
 * parâmetros. `toSqliteValue` já normalizou tipo; aqui só falta escapar.
 */

export type CommandRunner = (args: string[]) => Promise<string>;

export type RemoteD1Options = {
  /** Descarrega a cada N comandos. Lotes muito grandes estouram o limite do D1. */
  flushEvery?: number;
  /** Trocável em teste. */
  runner?: CommandRunner;
  /** Caminho do wrangler.jsonc, quando o D1 é declarado por ambiente. */
  configPath?: string;
};

export function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Número inválido para SQL: ${value}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Substitui cada `?` pelo literal correspondente, ignorando `?` dentro de texto. */
export function inlineBindings(query: string, values: unknown[]): string {
  let index = 0;
  let insideString = false;
  let out = "";

  for (let position = 0; position < query.length; position++) {
    const character = query[position];
    if (character === "'") {
      insideString = !insideString;
      out += character;
      continue;
    }
    if (character === "?" && !insideString) {
      if (index >= values.length) throw new Error("Faltam valores para os parâmetros da consulta");
      out += sqlLiteral(values[index++]);
      continue;
    }
    out += character;
  }

  if (index !== values.length) {
    throw new Error(`Sobraram ${values.length - index} valores sem parâmetro correspondente`);
  }
  return out;
}

const defaultRunner: CommandRunner = async (args) => {
  const { stdout } = await run("npx", ["wrangler", ...args], {
    maxBuffer: 64 * 1024 * 1024,
    env: process.env,
  });
  return stdout;
};

export function createRemoteD1(
  databaseName: string,
  options: RemoteD1Options = {},
): D1DatabaseLike & { flush(): Promise<void>; pendingCount(): number } {
  const flushEvery = options.flushEvery ?? 500;
  const runner = options.runner ?? defaultRunner;
  const pending: string[] = [];

  const baseArgs = () => {
    const args = ["d1", "execute", databaseName, "--remote", "--yes"];
    if (options.configPath) args.push("--config", options.configPath);
    return args;
  };

  async function flush(): Promise<void> {
    if (pending.length === 0) return;
    const statements = pending.splice(0, pending.length);
    const directory = await mkdtemp(path.join(tmpdir(), "oficina-d1-"));
    const file = path.join(directory, "lote.sql");
    try {
      // Cada comando pode já vir com ";" (o esquema vem assim). Sem aparar, a
      // junção gera instrução vazia e o wrangler recusa o arquivo inteiro com
      // "SQL code did not contain a statement".
      const body = statements
        .map((statement) => statement.trim().replace(/;+$/, "").trim())
        .filter((statement) => statement.length > 0)
        .join(";\n");
      if (body.length === 0) return;
      await writeFile(file, `${body};\n`, "utf8");
      await runner([...baseArgs(), "--file", file]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  async function query<T>(statement: string): Promise<T[]> {
    // Leitura enxerga a própria escrita.
    await flush();
    const stdout = await runner([...baseArgs(), "--json", "--command", statement]);
    const start = stdout.indexOf("[");
    if (start === -1) return [];
    const parsed = JSON.parse(stdout.slice(start)) as Array<{ results?: T[] }>;
    return parsed[0]?.results ?? [];
  }

  function prepare(query_: string): D1PreparedStatementLike {
    let bound: unknown[] = [];
    const statement: D1PreparedStatementLike = {
      bind(...values) {
        bound = values;
        return statement;
      },
      async first<T = Record<string, unknown>>() {
        const rows = await query<T>(inlineBindings(query_, bound));
        return rows[0] ?? null;
      },
      async all<T = Record<string, unknown>>() {
        return { results: await query<T>(inlineBindings(query_, bound)) };
      },
      async run() {
        pending.push(inlineBindings(query_, bound));
        if (pending.length >= flushEvery) await flush();
        return { meta: { changes: 0 } };
      },
    };
    return statement;
  }

  return {
    prepare,
    async batch(statements) {
      for (const statement of statements) await statement.run();
      await flush();
      return [];
    },
    flush,
    pendingCount: () => pending.length,
  };
}
