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
import { readFileSync } from "node:fs";
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
const remote = environment === "local" ? "--local" : "--remote";

console.log(`aplicando schema em ${database} (${remote})`);

const base = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", database, remote, "--file", schema, "--yes"],
  { cwd: root, stdio: "inherit", env: process.env },
);

if (base.status !== 0) process.exit(base.status ?? 1);

const patches = [path.join(root, "packages", "db", "d1", "0002_electoral_compliance.sql")];

for (const patch of patches) {
  console.log(`aplicando patch ${path.basename(patch)}`);

  const statements = readFileSync(patch, "utf8")
    .replace(/^--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const applied = spawnSync(
      "npx",
      ["wrangler", "d1", "execute", database, remote, "--command", statement, "--yes"],
      { cwd: root, encoding: "utf8", env: process.env },
    );

    const output = `${applied.stdout ?? ""}${applied.stderr ?? ""}`;

    if (applied.status === 0) {
      console.log(`  ok: ${statement}`);
      continue;
    }
    // Única falha aceitável: a coluna já existe de uma execução anterior.
    if (/duplicate column name/i.test(output)) {
      console.log(`  já aplicado: ${statement}`);
      continue;
    }

    console.error(output.trim());
    console.error(`falhou: ${statement}`);
    process.exit(applied.status ?? 1);
  }
}

console.log("schema e patches aplicados");
