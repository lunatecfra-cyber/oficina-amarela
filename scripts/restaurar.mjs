// Restaura um backup gerado por scripts/backup.mjs.
//
// Existe porque backup sem restauração não é backup: é um arquivo que ninguém
// nunca provou que serve. Este é o caminho de volta se a migração para o D1
// der errado — e ele é ensaiado, não descoberto no dia.
//
//   node scripts/restaurar.mjs --arquivo backups/oficina-amarela-....json \
//     --destino "postgres://..." --confirmar
//
// GUARDAS, de propósito:
//   - o destino é sempre explícito; não há padrão que aponte para produção;
//   - sem --confirmar o script só relata o que faria;
//   - destino com dado exige --sobrescrever, que TRUNCATE antes de inserir.
//
// A inserção respeita a ordem gravada no arquivo, que já vem ordenada por
// dependência. As sequências são recolocadas no fim, senão o próximo INSERT
// da aplicação colidiria com um id restaurado.

import { readFileSync } from "node:fs";
import postgres from "postgres";

const option = (name) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
};
const hasFlag = (name) => process.argv.includes(`--${name}`);

const file = option("arquivo");
// Só por --destino, nunca por variável de ambiente: a guarda desta ferramenta
// é o destino ser escrito à mão toda vez. Um DATABASE_URL herdado do shell
// apontando para produção transformaria um ensaio em restauração real.
const target = option("destino");
const confirm = hasFlag("confirmar");
const overwrite = hasFlag("sobrescrever");

if (!file || !target) {
  console.error(
    "Uso: --arquivo <backup.json> --destino <postgres://...> [--confirmar] [--sobrescrever]\n" +
      "     Sem --confirmar, só relata o que faria.",
  );
  process.exit(2);
}

const dump = JSON.parse(readFileSync(file, "utf8"));
const ordem = dump.ordem ?? Object.keys(dump.tabelas);

console.log(`arquivo : ${file} (gerado em ${dump.gerado_em})`);
console.log(`destino : ${target.replace(/:\/\/[^@]*@/, "://***@")}`);
console.log(confirm ? "modo    : restauração\n" : "modo    : relatório (nada será escrito)\n");

const sql = postgres(target, { prepare: false, onnotice: () => {} });
let exitCode = 0;

try {
  const existing = [];
  for (const table of ordem) {
    const [row] = await sql`
      SELECT count(*)::int AS total FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${table}
    `;
    if (!row?.total) {
      console.log(`  ${table.padEnd(24)} AUSENTE NO DESTINO — aplique o schema antes`);
      exitCode = 1;
      continue;
    }
    const [count] = await sql`SELECT count(*)::int AS total FROM ${sql(table)}`;
    if (count.total > 0) existing.push(`${table} (${count.total})`);
    console.log(
      `  ${table.padEnd(24)} arquivo ${String(dump.tabelas[table]?.length ?? 0).padStart(6)}` +
        `   destino ${String(count.total).padStart(6)}`,
    );
  }

  if (exitCode) throw new Error("Destino não tem todas as tabelas do backup.");

  if (existing.length && !overwrite) {
    throw new Error(
      `O destino já tem dado em: ${existing.join(", ")}.\n` +
        "Use --sobrescrever para esvaziar essas tabelas antes de restaurar.",
    );
  }

  if (!confirm) {
    console.log("\nNada foi escrito. Repita com --confirmar para restaurar.");
  } else {
    if (overwrite && existing.length) {
      // TRUNCATE numa lista só: CASCADE resolve as dependências entre elas.
      await sql`TRUNCATE ${sql.unsafe(ordem.map((t) => `"${t}"`).join(", "))} RESTART IDENTITY CASCADE`;
      console.log("\nTabelas esvaziadas.");
    }

    // Coluna gerada (users.nivel é GENERATED ALWAYS) não aceita valor: o
    // PostgreSQL recusa o INSERT inteiro. Ela sai da restauração e o banco a
    // recalcula sozinho a partir das colunas que a alimentam.
    const generated = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public'
        AND (is_generated = 'ALWAYS' OR is_identity = 'YES')
    `;
    const skip = new Map();
    for (const { table_name, column_name } of generated) {
      if (!skip.has(table_name)) skip.set(table_name, new Set());
      skip.get(table_name).add(column_name);
    }
    for (const [table, columns] of skip) {
      console.log(`  ${table}: coluna gerada fora da restauração — ${[...columns].join(", ")}`);
    }

    /**
     * Colunas json/jsonb precisam ir marcadas como json.
     *
     * O driver deduz o tipo do parâmetro pelo valor em JavaScript. Um jsonb
     * que guarda [[true,false],[false,true]] — a grade de disponibilidade do
     * editor — chega como array de arrays de boolean e vira array de boolean
     * do PostgreSQL: "column disponibilidade is of type jsonb but expression
     * is of type boolean". Só aparece com dado de verdade; com a coluna nula
     * o ensaio passava limpo.
     *
     * `sql.json` e não `JSON.stringify`: a string seria gravada como VALOR
     * json — o objeto inteiro escapado dentro de aspas — e a leitura seguinte
     * devolveria texto onde a aplicação espera objeto.
     */
    const jsonColumns = await sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type IN ('json', 'jsonb')
    `;
    const asJson = new Map();
    for (const { table_name, column_name } of jsonColumns) {
      if (!asJson.has(table_name)) asJson.set(table_name, new Set());
      asJson.get(table_name).add(column_name);
    }

    let total = 0;
    for (const table of ordem) {
      const omit = skip.get(table);
      const json = asJson.get(table);
      const rows = (dump.tabelas[table] ?? []).map((row) => {
        const out = {};
        for (const [key, value] of Object.entries(row)) {
          if (omit?.has(key)) continue;
          out[key] = json?.has(key) && value !== null ? sql.json(value) : value;
        }
        return out;
      });
      if (!rows.length) continue;
      // Em lotes: um INSERT com milhares de linhas estoura o limite de
      // parâmetros do protocolo.
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        await sql`INSERT INTO ${sql(table)} ${sql(batch)} ON CONFLICT DO NOTHING`;
      }
      total += rows.length;
      console.log(`  ${table.padEnd(24)} ${String(rows.length).padStart(6)} linhas restauradas`);
    }

    // As sequências ficaram onde estavam; sem isto o próximo id colide.
    const sequences = await sql`
      SELECT c.relname AS table_name, a.attname AS column_name,
             pg_get_serial_sequence(quote_ident(c.relname), a.attname) AS sequence
      FROM pg_class c
      JOIN pg_attribute a ON a.attrelid = c.oid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND a.attnum > 0
        AND pg_get_serial_sequence(quote_ident(c.relname), a.attname) IS NOT NULL
    `;
    for (const { table_name, column_name, sequence } of sequences) {
      await sql`
        SELECT setval(${sequence},
          COALESCE((SELECT max(${sql(column_name)}) FROM ${sql(table_name)}), 0) + 1, false)
      `;
    }
    console.log(`\n  ${total} linhas restauradas; ${sequences.length} sequências recolocadas.`);
  }
} catch (error) {
  console.error(`\nRestauração interrompida: ${error.message}`);
  exitCode = 1;
} finally {
  await sql.end();
}

process.exit(exitCode);
