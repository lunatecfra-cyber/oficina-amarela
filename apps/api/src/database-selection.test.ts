// Duas vezes seguidas um caminho de execução escapou da escolha de banco e foi
// direto no PostgreSQL: primeiro o Cron e o consumidor de fila, depois o
// Durable Object da reserva de missão. Nos dois casos staging e produção não
// têm PostgreSQL, então a operação simplesmente morria — e nenhum teste local
// pegava, porque local tem PostgreSQL.
//
// Este teste lê os arquivos e falha se algum módulo fora da lista pegar um
// repositório PostgreSQL direto. A escolha tem que passar por dependenciesFor
// ou pelo binding.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const SOURCE = path.dirname(fileURLToPath(import.meta.url));

/** Quem pode citar o conjunto PostgreSQL: é onde a escolha acontece. */
const ALLOWED = new Set([
  "dependencies.ts", // define o conjunto
  "app.ts", // dependenciesFor escolhe entre D1 e o fallback
  "index.ts", // passa o fallback para fetch, scheduled e queue
  // O coordenador é o quarto ponto de escolha: tem env próprio, separado do
  // Worker. Que ele escolha certo é o que o segundo teste garante.
  "durable-objects/mission-coordinator.ts",
]);

const FORBIDDEN = /\bpostgres(?:MissionQueue|ApiDependencies|MissionApproval|Missions|Profiles)\b/;

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(full)));
    else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) files.push(full);
  }
  return files;
}

describe("escolha de banco", () => {
  test("nenhum módulo fora da lista pega o PostgreSQL direto", async () => {
    const offenders: string[] = [];

    for (const file of await sourceFiles(SOURCE)) {
      if (ALLOWED.has(path.relative(SOURCE, file))) continue;
      const contents = await readFile(file, "utf8");
      if (FORBIDDEN.test(contents)) offenders.push(path.relative(SOURCE, file));
    }

    assert.deepEqual(
      offenders,
      [],
      `estes módulos escapam da escolha de banco e quebram em staging/produção: ${offenders.join(", ")}`,
    );
  });

  test("o Durable Object escolhe pelo binding DB", async () => {
    const source = await readFile(
      path.join(SOURCE, "durable-objects", "mission-coordinator.ts"),
      "utf8",
    );
    assert.match(source, /this\.env\.DB/, "o coordenador precisa olhar o binding DB");
    assert.match(source, /createD1MissionQueue/, "e usar o repositório D1 quando ele existe");
  });
});
