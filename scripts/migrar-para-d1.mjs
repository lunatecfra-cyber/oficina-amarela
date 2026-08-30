/**
 * Ensaio de migração PostgreSQL → D1.
 *
 * Origem e destino são sempre explícitos: não há padrão que aponte para
 * produção sem alguém escrever o endereço. Nada aqui apaga dado — a carga é
 * `INSERT OR IGNORE`, então repetir é seguro e retomar também.
 *
 *   node scripts/migrar-para-d1.mjs --origem "postgres://..." --destino ./ensaio-d1 --a-seco
 *   node scripts/migrar-para-d1.mjs --origem "postgres://..." --destino ./ensaio-d1
 *   node scripts/migrar-para-d1.mjs --origem "postgres://..." --destino ./ensaio-d1 --so-conferir
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

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.join(aqui, "..");

const { applyD1Tables, applyD1Triggers } = await import(
  path.join(raiz, "packages/db/src/d1/schema.ts")
);
const { backfillD1EventTables, migrateToD1 } = await import(
  path.join(raiz, "packages/db/src/migration/pg-to-d1.ts")
);
const { validateMigration } = await import(
  path.join(raiz, "packages/db/src/migration/validate.ts")
);

function opcao(nome) {
  const indice = process.argv.indexOf(`--${nome}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}
const tem = (nome) => process.argv.includes(`--${nome}`);

const origem = opcao("origem") ?? process.env.MIGRACAO_ORIGEM_URL;
const destino = opcao("destino") ?? process.env.MIGRACAO_DESTINO_D1;
const aSeco = tem("a-seco");
const soConferir = tem("so-conferir");

if (!origem || !destino) {
  console.error(
    "Uso: --origem <postgres://...> --destino <pasta do D1 local>\n" +
      "     [--a-seco] só lê e relata; [--so-conferir] pula a carga e confere.\n" +
      "Origem e destino são obrigatórios de propósito.",
  );
  process.exit(2);
}

const sql = postgres(origem, { prepare: false });
const miniflare = new Miniflare(
  convertV4MiniflareOptions({
    compatibilityDate: "2026-08-30",
    d1Databases: { DB: "oficina-ensaio" },
    // O D1 local guarda o estado nesta pasta. É o que torna o ensaio retomável:
    // parar no meio e rodar de novo continua de onde parou.
    resourcePersistencePath: path.resolve(destino),
    modules: true,
    script: "export default { fetch() { return new Response('ok') } }",
  }),
);

function tabela(linhas) {
  const largura = Math.max(...linhas.map((l) => l.table.length), 10);
  for (const linha of linhas) {
    console.log(
      `  ${linha.table.padEnd(largura)}  origem ${String(linha.source).padStart(7)}` +
        `  carregadas ${String(linha.loaded).padStart(7)}` +
        `  já existiam ${String(linha.skipped).padStart(7)}` +
        `  destino ${String(linha.target).padStart(7)}`,
    );
  }
}

let saida = 0;
try {
  const db = await miniflare.getD1Database("DB");
  const schema = await readFile(path.join(raiz, "packages/db/d1/0001_mission_slice.sql"), "utf8");

  console.log(`origem : ${origem.replace(/:\/\/[^@]*@/, "://***@")}`);
  console.log(`destino: ${path.resolve(destino)}`);
  console.log(aSeco ? "modo   : a seco (não grava nada)\n" : "modo   : carga\n");

  if (!soConferir) {
    // As tabelas primeiro; os gatilhos só depois da carga, para o histórico
    // não reaplicar pontuação, reputação, ranking e auditoria.
    await applyD1Tables(db, schema).catch((erro) => {
      if (!/already exists/i.test(String(erro))) throw erro;
    });

    const relatorio = await migrateToD1(sql, db, { dryRun: aSeco });
    console.log("Tabelas:");
    tabela(relatorio.tables);

    if (!aSeco) {
      // O backfill do histórico só é seguro com os gatilhos desligados. Numa
      // retomada eles já estão ligados: aí o passo é pulado, e é dito em voz
      // alta — histórico que apareceu depois pede um ensaio em destino limpo.
      try {
        const eventos = await backfillD1EventTables(sql, db);
        console.log("\nTabelas de evento (backfill sem gatilho):");
        tabela(eventos);
      } catch (erro) {
        if (!/gatilhos de evento já estão ligados/.test(String(erro))) throw erro;
        console.log(
          "\nTabelas de evento: backfill pulado — os gatilhos já estão ligados\n" +
            "  neste destino. Se houver histórico novo na origem, refaça o ensaio\n" +
            "  em um destino limpo em vez de carregar por cima.",
        );
      }

      await applyD1Triggers(db, schema).catch((erro) => {
        if (!/already exists/i.test(String(erro))) throw erro;
      });
      console.log("\nGatilhos ligados.");
    }
  }

  if (aSeco) {
    console.log("\nA seco: nada foi gravado, e por isso não há o que conferir.");
  } else {
    const divergencias = await validateMigration(sql, db);
    if (divergencias.length === 0) {
      console.log("\nConferência: sem divergência.");
    } else {
      console.log(`\nConferência: ${divergencias.length} divergência(s).`);
      for (const item of divergencias) {
        console.log(`  [${item.kind}] ${item.table}: ${item.detail}`);
      }
      saida = 1;
    }
  }
} catch (erro) {
  console.error("\nEnsaio interrompido:", erro instanceof Error ? erro.message : erro);
  saida = 1;
} finally {
  await sql.end();
  await miniflare.dispose();
}

process.exit(saida);
