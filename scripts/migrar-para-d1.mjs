/**
 * Ensaio de migração PostgreSQL → D1.
 *
 * Origem e destino são sempre explícitos: não há padrão que aponte para
 * produção sem alguém escrever o endereço. Nada aqui apaga dado — a carga é
 * __LIT0__, então repetir é seguro e retomar também.
 *
 *   node scripts/migrar-para-d1.mjs --origem __LIT1__ --destino ./ensaio-d1 --a-seco
 *   node scripts/migrar-para-d1.mjs --origem __LIT2__ --destino ./ensaio-d1
 *   node scripts/migrar-para-d1.mjs --origem __LIT3__ --destino ./ensaio-d1 --so-conferir
 *
 * O destino é um D1 local (Miniflare). Para um D1 remoto, aponte o ensaio para
 * uma cópia local primeiro: a conferência é a mesma, e é ela que decide se a
 * migração de verdade pode acontecer.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const { applyD1Tables, applyD1Triggers } = await import(
  path.join(root, "packages/db/src/d1/schema.ts")
);
const { backfillD1EventTables, migrateToD1 } = await import(
  path.join(root, "packages/db/src/migration/pg-to-d1.ts")
);
const { validateMigration } = await import(
  path.join(root, "packages/db/src/migration/validate.ts")
);

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const source = option("origem") ?? process.env.MIGRACAO_ORIGEM_URL;
const target = option("destino") ?? process.env.MIGRACAO_DESTINO_D1;
const dryRun = hasFlag("a-seco");
const validateOnly = hasFlag("so-conferir");

if (!source || !target) {
  console.error(
    "Uso: --origem <postgres://...> --destino <pasta do D1 local>\n" +
      "     [--a-seco] só lê e relata; [--so-conferir] pula a carga e confere.\n" +
      "Origem e destino são obrigatórios de propósito.",
  );
  process.exit(2);
}

const sql = postgres(source, { prepare: false });
const miniflare = new Miniflare(
  convertV4MiniflareOptions({
    compatibilityDate: "2026-08-30",
    d1Databases: { DB: "oficina-ensaio" },
    // O D1 local guarda o estado nesta pasta. É o que torna o ensaio retomável:
    // parar no meio e rodar de novo continua de onde parou.
    resourcePersistencePath: path.resolve(target),
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
  }),
);

function printTable(rows) {
  const width = Math.max(...rows.map((entry) => entry.table.length), 10);
  for (const row of rows) {
    console.log(
      `  ${row.table.padEnd(width)}  origem ${String(row.source).padStart(7)}` +
        `  carregadas ${String(row.loaded).padStart(7)}` +
        `  já existiam ${String(row.skipped).padStart(7)}` +
        `  destino ${String(row.target).padStart(7)}`,
    );
  }
}

let exitCode = 0;
try {
  const db = await miniflare.getD1Database("DB");
  const schema = await readFile(path.join(root, "packages/db/d1/0001_mission_slice.sql"), "utf8");

  console.log(`origem : ${source.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(`destino: ${path.resolve(target)}`);
  console.log(dryRun ? "modo   : a seco (não grava nada)\n" : "modo   : carga\n");

  if (!validateOnly) {
    // As tabelas primeiro; os gatilhos só depois da carga, para o histórico
    // não reaplicar pontuação, reputação, ranking e auditoria.
    await applyD1Tables(db, schema).catch((error) => {
      if (!/already exists/i.test(String(error))) throw error;
    });

    const report = await migrateToD1(sql, db, { dryRun: dryRun });
    console.log("Tabelas:");
    printTable(report.tables);

    if (!dryRun) {
      // O backfill do histórico só é seguro com os gatilhos desligados. Numa
      // retomada eles já estão ligados: aí o passo é pulado, e é dito em voz
      // alta — histórico que apareceu depois pede um ensaio em destino limpo.
      try {
        const events = await backfillD1EventTables(sql, db);
        console.log("\nTabelas de evento (backfill sem gatilho):");
        printTable(events);
      } catch (error) {
        if (!/gatilhos de evento já estão ligados/.test(String(error))) throw error;
        console.log(
          "\nTabelas de evento: backfill pulado — os gatilhos já estão ligados\n" +
            "  neste destino. Se houver histórico novo na origem, refaça o ensaio\n" +
            "  em um destino limpo em vez de carregar por cima.",
        );
      }

      await applyD1Triggers(db, schema).catch((error) => {
        if (!/already exists/i.test(String(error))) throw error;
      });
      console.log("\nGatilhos ligados.");
    }
  }

  if (dryRun) {
    console.log("\nA seco: nada foi gravado, e por isso não há o que conferir.");
  } else {
    const discrepancies = await validateMigration(sql, db);
    if (discrepancies.length === 0) {
      console.log("\nConferência: sem divergência.");
    } else {
      console.log(`\nConferência: ${discrepancies.length} divergência(s).`);
      for (const entry of discrepancies) {
        console.log(`  [${entry.kind}] ${entry.table}: ${entry.detail}`);
      }
      exitCode = 1;
    }
  }
} catch (error) {
  console.error("\nEnsaio interrompido:", error instanceof Error ? error.message : error);
  exitCode = 1;
} finally {
  await sql.end();
  await miniflare.dispose();
}

process.exit(exitCode);
