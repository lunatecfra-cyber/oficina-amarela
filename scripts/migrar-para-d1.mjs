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
 * ANTES DE MIGRAR: aplique `supabase/migrations` na ORIGEM. O recorte de
 * colunas vem do esquema do D1, então uma origem uma migração atrás faz o
 * SELECT citar coluna que não existe. A carga confere isso antes de escrever
 * qualquer linha e para com a lista do que falta.
 *
 * O destino pode ser um D1 local (Miniflare) ou um D1 remoto de verdade:
 *
 *   node scripts/migrar-para-d1.mjs --origem "postgres://..." \
 *     --destino-remoto oficina-amarela
 *
 * ATENÇÃO — desligue o Cron do Worker de destino antes de migrar.
 *
 * O Cron roda a cada minuto e chama dispatchOffers e expireOffers. Com ele
 * ligado durante a carga, ele mexe no que está sendo carregado: num ensaio
 * contra o staging apareceu uma oferta que a origem não tinha, criada pelo
 * despacho no meio da migração. Para desligar, publique o Worker sem
 * `triggers.crons` e republique depois, ou pause o Worker.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import postgres from "postgres";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const { applyAllD1Migrations, applyD1Triggers, dropD1Triggers } = await import(
  path.join(root, "packages/db/src/d1/schema.ts")
);
const { backfillD1EventTables, findColumnGaps, migrateToD1, MIGRATION_PLAN } = await import(
  path.join(root, "packages/db/src/migration/pg-to-d1.ts")
);
const { validateMigration } = await import(
  path.join(root, "packages/db/src/migration/validate.ts")
);
const { createRemoteD1 } = await import(path.join(root, "packages/db/src/migration/remote-d1.ts"));

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}
const hasFlag = (name) => process.argv.includes(`--${name}`);

const source = option("origem") ?? process.env.MIGRACAO_ORIGEM_URL;
const target = option("destino") ?? process.env.MIGRACAO_DESTINO_D1;
// Destino remoto: um D1 de verdade, pelo wrangler. É o caminho do dia da
// migração; o destino local continua sendo o do ensaio.
const remoteTarget = option("destino-remoto");
const dryRun = hasFlag("a-seco");
const validateOnly = hasFlag("so-conferir");
const allowMissingColumns = hasFlag("aceitar-colunas-ausentes");
// Ensaio focado: --tabelas users,pautas carrega só essas (e pula backfill e
// conferência das demais). Útil para depurar tradução PT→EN sem varrer o banco.
const onlyTables = option("tabelas")
  ? option("tabelas")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  : null;

if (!source || (!target && !remoteTarget)) {
  console.error(
    "Uso: --origem <postgres://...> --destino <pasta do D1 local>\n" +
      "     --origem <postgres://...> --destino-remoto <nome do banco D1>\n" +
      "     [--a-seco] só lê e relata; [--so-conferir] pula a carga e confere.\n" +
      "     [--aceitar-colunas-ausentes] carrega mesmo faltando coluna na origem.\n" +
      "     [--tabelas a,b] ensaia só essas tabelas (nomes de ORIGEM, ex.: pautas).\n" +
      "Origem e destino são obrigatórios de propósito.",
  );
  process.exit(2);
}
if (target && remoteTarget) {
  console.error("Escolha um destino: --destino (local) ou --destino-remoto. Não os dois.");
  process.exit(2);
}

const sql = postgres(source, { prepare: false });
const miniflare = remoteTarget
  ? null
  : new Miniflare(
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
let db;
let triggersDropped = false;
const restoreTriggers = async () => {
  if (!triggersDropped || dryRun || !db) return;
  try {
    await applyD1Triggers(db, fullSchema);
    console.log("\nGatilhos religados após interrupção.");
  } catch {
    console.error("\nATENÇÃO: os gatilhos foram desligados e NÃO puderam ser religados.");
    console.error("Rode o script de novo em destino limpo ou aplique os triggers à mão.");
  }
  triggersDropped = false;
};
process.on("SIGINT", async () => {
  console.error("\nInterrompido — religando gatilhos antes de sair...");
  await restoreTriggers();
  process.exit(130);
});
try {
  db = remoteTarget ? createRemoteD1(remoteTarget) : await miniflare.getD1Database("DB");
  // Esquema COMPLETO (0001+0002+0003), não só o 0001: o D1 de produção já fala
  // inglês, e ensaiar contra o português antigo dava falsa confiança — a carga
  // passava no ensaio e quebrava na produção com "tabela ausente".
  const d1Dir = path.join(root, "packages/db/d1");
  const fullSchema = [
    await readFile(path.join(d1Dir, "0001_mission_slice.sql"), "utf8"),
    await readFile(path.join(d1Dir, "0002_electoral_compliance.sql"), "utf8"),
    await readFile(path.join(d1Dir, "0003_rename_to_english.sql"), "utf8"),
  ].join("\n");

  console.log(`origem : ${source.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(`destino: ${remoteTarget ? `D1 remoto ${remoteTarget}` : path.resolve(target)}`);
  console.log(dryRun ? "modo   : a seco (não grava nada)\n" : "modo   : carga\n");
  if (onlyTables) console.log(`tabelas: só ${onlyTables.join(", ")} (nomes de origem)\n`);
  const plan = onlyTables ? MIGRATION_PLAN.filter((e) => onlyTables.includes(e.table)) : undefined;
  if (onlyTables && plan.length === 0) {
    throw new Error(`--tabelas não bateu com nenhuma tabela do plano: ${onlyTables.join(", ")}`);
  }

  if (!validateOnly) {
    // As tabelas primeiro; os gatilhos só depois da carga, para o histórico
    // não reaplicar pontuação, reputação, ranking e auditoria.
    // applyAllD1Migrations é idempotente: reaplicar depois de falha parcial é seguro.
    await applyAllD1Migrations(db);

    // Conferir colunas ANTES de desligar gatilho. Parar aqui é seguro: nada foi
    // escrito e o destino continua com os gatilhos que tinha. Parar depois
    // deixaria um D1 sem gatilho nenhum, que é pior que não ter migrado.
    const gaps = await findColumnGaps(sql, db, plan);
    if (gaps.length) {
      const detail = gaps.map(({ table, missing }) => `  ${table}: ${missing.join(", ")}`);
      if (!allowMissingColumns) {
        throw new Error(
          `A origem não tem colunas que o destino espera:\n${detail.join("\n")}\n` +
            "Aplique supabase/migrations na origem antes de migrar, ou use " +
            "--aceitar-colunas-ausentes para carregá-las como nulas.",
        );
      }
      console.log(`Colunas ausentes na origem, entrarão nulas:\n${detail.join("\n")}\n`);
    }

    // O destino real já vem com o esquema completo, gatilhos inclusive. Carregar
    // histórico com eles ligados reaplicaria pontuação, reputação, ranking e
    // auditoria. Desliga antes, religa no fim.
    if (!dryRun) {
      const dropped = await dropD1Triggers(db, fullSchema);
      triggersDropped = dropped > 0;
      console.log(`Gatilhos desligados para a carga: ${dropped}\n`);
    }

    const report = await migrateToD1(sql, db, {
      dryRun,
      allowMissingColumns,
      plan,
      onProgress: (table, done, total) => {
        if (remoteTarget && (done % 1000 === 0 || done === total)) {
          console.log(`  ${table}: ${done}/${total}`);
        }
      },
    });
    console.log("Tabelas:");
    printTable(report.tables);

    if (!dryRun) {
      // O backfill do histórico só é seguro com os gatilhos desligados. Numa
      // retomada eles já estão ligados: aí o passo é pulado, e é dito em voz
      // alta — histórico que apareceu depois pede um ensaio em destino limpo.
      try {
        if (!onlyTables || onlyTables.includes("ranking_aprovacoes")) {
          const events = await backfillD1EventTables(sql, db);
          console.log("\nTabelas de evento (backfill sem gatilho):");
          printTable(events);
        }
      } catch (error) {
        if (!/gatilhos de evento já estão ligados/.test(String(error))) throw error;
        console.log(
          "\nTabelas de evento: backfill pulado — os gatilhos já estão ligados\n" +
            "  neste destino. Se houver histórico novo na origem, refaça o ensaio\n" +
            "  em um destino limpo em vez de carregar por cima.",
        );
      }

      await applyD1Triggers(db, fullSchema).catch((error) => {
        if (!/already exists/i.test(String(error))) throw error;
      });
      triggersDropped = false;
      console.log("\nGatilhos ligados.");
    }
  }

  if (dryRun) {
    console.log("\nA seco: nada foi gravado, e por isso não há o que conferir.");
  } else {
    const discrepancies = await validateMigration(sql, db, plan);
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
  if (db?.flush) await db.flush();
  await miniflare?.dispose();
}

process.exit(exitCode);
