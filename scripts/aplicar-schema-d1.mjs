// Aplica o schema D1 no ambiente pedido.
//
//   node scripts/aplicar-schema-d1.mjs staging
//   node scripts/aplicar-schema-d1.mjs production
//   node scripts/aplicar-schema-d1.mjs local
//
// Existe porque `wrangler d1 migrations apply` NÃO funciona neste schema: o
// splitter corta em ";" e quebra o corpo dos CREATE TRIGGER, falhando com
// "incomplete input" no meio do arquivo. `d1 execute --file` manda o arquivo
// inteiro e respeita os triggers.
//
// O schema é idempotente, então reaplicar é seguro.
//
// Depois do schema base vêm os arquivos de patch (0002 em diante). Eles são
// ALTER TABLE, e o SQLite não tem ADD COLUMN IF NOT EXISTS — então cada
// instrução vai sozinha e "duplicate column name" conta como já aplicada.

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATABASES = {
  staging: "oficina-amarela-staging",
  production: "oficina-amarela",
  local: "oficina-amarela-staging",
};

const environment = process.argv[2];
const database = DATABASES[environment];

if (!database) {
  console.error(
    `Ambiente inválido: ${environment ?? "(nenhum)"}\n` +
      `Use um de: ${Object.keys(DATABASES).join(", ")}`,
  );
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = path.join(root, "packages", "db", "d1", "0001_mission_slice.sql");
const config = path.join(root, "apps", "api", "wrangler.jsonc");
const remote = environment === "local" ? "--local" : "--remote";
const envFlag = environment === "production" ? ["--env", "production"] : ["--env", "staging"];
const targetDb = environment === "local" ? "DB" : database;

console.log(`aplicando schema em ${database} (${remote})`);

const base = spawnSync(
  "npx",
  [
    "wrangler",
    "d1",
    "execute",
    targetDb,
    remote,
    "--config",
    config,
    ...envFlag,
    "--file",
    schema,
    "--yes",
  ],
  { cwd: root, stdio: "inherit", env: process.env },
);

if (base.status !== 0) process.exit(base.status ?? 1);

const patches = [
  path.join(root, "packages", "db", "d1", "0002_electoral_compliance.sql"),
  path.join(root, "packages", "db", "d1", "0003_rename_to_english.sql"),
];

for (const patch of patches) {
  console.log(`aplicando patch ${path.basename(patch)}`);

  const raw = readFileSync(patch, "utf8");
  const statements = [];
  let current = "";
  let inTrigger = false;
  for (const line of raw.replace(/^--.*$/gm, "").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("CREATE TRIGGER")) inTrigger = true;
    current += `${line}\n`;
    if ((!inTrigger && trimmed.endsWith(";")) || (inTrigger && trimmed === "END;")) {
      statements.push(current.trim());
      current = "";
      inTrigger = false;
    }
  }

  for (const statement of statements) {
    // CREATE TRIGGER vai por arquivo, não por --command.
    //
    // O `--command` do wrangler corta a instrução no primeiro ";", e o corpo de
    // um gatilho é cheio deles: a API recebe só até o primeiro e responde
    // "incomplete input: SQLITE_ERROR". Como os DROP TRIGGER rodam antes, o
    // banco ficava SEM nenhum gatilho — foi o que aconteceu no ensaio em
    // staging (2026-09-02), que perdeu as cinco travas de concorrência.
    // `--file` manda o conteúdo inteiro e respeita o corpo do gatilho.
    const isTrigger = statement.startsWith("CREATE TRIGGER");
    let triggerFile;
    if (isTrigger) {
      triggerFile = path.join(tmpdir(), `oficina-trigger-${randomUUID()}.sql`);
      writeFileSync(triggerFile, `${statement}\n`);
    }
    const how = isTrigger ? ["--file", triggerFile] : ["--command", statement];

    // Uma instrução por chamada significa uma autenticação por instrução, e a
    // API responde "Authentication error [code: 10000]" quando elas vêm em
    // rajada. É transitório: a mesma instrução passa segundos depois. Sem a
    // repetição, o patch parava no meio — pior num banco de produção, que
    // ficava com parte das colunas.
    let applied;
    let output = "";
    for (let attempt = 1; attempt <= 4; attempt++) {
      applied = spawnSync(
        "npx",
        [
          "wrangler",
          "d1",
          "execute",
          targetDb,
          remote,
          "--config",
          config,
          ...envFlag,
          ...how,
          "--yes",
        ],
        { cwd: root, encoding: "utf8", env: process.env },
      );
      output = `${applied.stdout ?? ""}${applied.stderr ?? ""}`;
      if (applied.status === 0 || !/Authentication error|code: 10000|rate limit/i.test(output)) {
        break;
      }
      const wait = 2000 * attempt;
      console.log(`  autenticação falhou, tentando de novo em ${wait / 1000}s`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
    }

    if (triggerFile) rmSync(triggerFile, { force: true });

    if (applied.status === 0) {
      console.log(`  ok: ${statement}`);
      continue;
    }
    // Falhas aceitáveis, significando "já está como deveria":
    // a coluna já existe (ADD repetido), a coluna antiga não existe mais
    // (RENAME num banco que já nasceu com o nome novo), a tabela já foi
    // renomeada (no such table para a tabela antiga) ou já existe.
    //
    // "there is already another table or index with this name" é o que o SQLite
    // responde a `ALTER TABLE pautas RENAME TO missions` quando missions já
    // existe — reexecução depois de uma migração completa. Sem este caso o
    // script não era reexecutável, e reexecutar é justamente o que se faz
    // quando a primeira tentativa para no meio.
    if (
      /duplicate column name|no such column|no such table|already exists|there is already another table or index with this name/i.test(
        output,
      )
    ) {
      console.log(`  já aplicado: ${statement}`);
      continue;
    }

    console.error(output.trim());
    console.error(`falhou: ${statement}`);
    process.exit(applied.status ?? 1);
  }
}

console.log("schema e patches aplicados");
