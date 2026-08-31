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

import { spawnSync } from "node:child_process";
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

const result = spawnSync(
  "npx",
  ["wrangler", "d1", "execute", database, remote, "--file", schema, "--yes"],
  { cwd: root, stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
