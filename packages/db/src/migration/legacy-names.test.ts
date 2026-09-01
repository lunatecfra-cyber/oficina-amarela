import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { describe } from "node:test";
import { fileURLToPath } from "node:url";
import {
  LEGACY_COLUMNS,
  LEGACY_TABLES,
  legacyColumnOf,
  renamedColumn,
  renamedTable,
} from "./legacy-names.ts";

/**
 * O de-para tem que cobrir o schema inteiro.
 *
 * Uma coluna em português que fique de fora não dá erro em lugar nenhum: ela
 * simplesmente continua em português, e o banco fica metade numa língua e
 * metade na outra — que é exatamente o estado que esta renomeação existe para
 * acabar. Ver docs/SCHEMA_LANGUAGE.md.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/**
 * Palavra portuguesa em nome de coluna: acento, ou raiz que só existe em PT.
 *
 * `portfolio` fica de fora da lista de propósito — é a mesma palavra nas duas
 * línguas, então não serve de sinal e só produzia falso positivo.
 */
function looksPortuguese(name: string): boolean {
  if (/[çãáéíóúâêõà]/.test(name)) return true;
  return /(^|_)(apelido|nome|senha|papel|criad[oa]|criada|sessoes|localizacao|entregues|reputacao|nota|nivel|travado|banido|banimento|motivo|softwares|estilos|disponibilidade|completo|edicao|nicho|foto|cargo|disputa|eleicao|bandeiras|tom|palavras|redes|marca|dagua|cnpj|titulo|eleitor|ultimo|visto|codigo|indicacao|indicado|voz|formato|brief_tom|brief_cor|brief_fonte|bruto|entrega|reservada|inspetor|reedicao|pedida|prazo|desejado|prioridade|pontuada|chave|tentativas|primeira|destinatario|assunto|processar|apos|enviado|erro|executada|pauta|autor|texto|denunciante|denunciado|resolvida|comentario|tamanho|adicionado|publicada|descricao|ciclo|ativa|regra|referencia|inicia|termina|congelado|editores|aprovado|anulado|anulacao|expira|usado|revogado|revogacao|convidado|convidador|pontos|premiado|concedido|consumido|semana|ator|acao|entidade|detalhes|icone|conquistada|oferecida|respondida|ordem|link_video|resgatado)(_|$)/.test(
    name,
  );
}

function schemaSql(): string {
  let sql = readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8");
  const dir = path.join(ROOT, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
    sql += readFileSync(path.join(dir, file), "utf8");
  }
  sql += readFileSync(path.join(ROOT, "packages/db/d1/0001_mission_slice.sql"), "utf8");
  return sql;
}

type Declared = { table: string; column: string };

function declaredColumns(): Declared[] {
  const found: Declared[] = [];
  const blocks = schemaSql().matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)\s*\(([\s\S]*?)\n\);/g);
  for (const [, table, body] of blocks) {
    for (const line of body.split("\n")) {
      const match = line.match(
        /^\s*(\w+)\s+(TEXT|INT|INTEGER|BIGSERIAL|SERIAL|BOOLEAN|TIMESTAMPTZ|JSONB|NUMERIC|UUID|REAL|DATE)/,
      );
      if (match) found.push({ table, column: match[1] });
    }
  }
  return found;
}

describe("cobertura do de-para de nomes", () => {
  test("o schema foi lido de verdade", () => {
    const declared = declaredColumns();
    assert.ok(declared.length > 150, `poucas colunas encontradas: ${declared.length}`);
    assert.ok(declared.some((d) => d.table === "users" && d.column === "email"));
  });

  test("toda coluna em português tem nome novo", () => {
    const missing = declaredColumns()
      .filter(({ table, column }) => looksPortuguese(column) && !LEGACY_COLUMNS[table]?.[column])
      .map(({ table, column }) => `${table}.${column}`);
    assert.deepEqual([...new Set(missing)], []);
  });

  test("toda tabela em português tem nome novo", () => {
    const tables = new Set(declaredColumns().map((d) => d.table));
    const missing = [...tables].filter((t) => looksPortuguese(t) && !LEGACY_TABLES[t]);
    assert.deepEqual(missing, []);
  });

  test("nome novo nunca é português", () => {
    const offenders: string[] = [];
    for (const renamed of Object.values(LEGACY_TABLES)) {
      if (looksPortuguese(renamed)) offenders.push(`tabela ${renamed}`);
    }
    for (const [table, columns] of Object.entries(LEGACY_COLUMNS)) {
      for (const renamed of Object.values(columns)) {
        if (looksPortuguese(renamed)) offenders.push(`${table}.${renamed}`);
      }
    }
    assert.deepEqual(offenders, []);
  });

  test("dois nomes antigos nunca viram o mesmo nome novo na mesma tabela", () => {
    const collisions: string[] = [];
    for (const [table, columns] of Object.entries(LEGACY_COLUMNS)) {
      const seen = new Map<string, string>();
      for (const [legacy, renamed] of Object.entries(columns)) {
        const first = seen.get(renamed);
        if (first) collisions.push(`${table}: ${first} e ${legacy} → ${renamed}`);
        seen.set(renamed, legacy);
      }
    }
    assert.deepEqual(collisions, []);
  });
});

describe("consulta ao de-para", () => {
  test("traduz nos dois sentidos", () => {
    assert.equal(renamedTable("pautas"), "missions");
    assert.equal(renamedColumn("pautas", "porta_voz_id"), "spokesperson_id");
    assert.equal(legacyColumnOf("pautas", "spokesperson_id"), "porta_voz_id");
  });

  test("o que já estava em inglês passa intacto", () => {
    assert.equal(renamedTable("users"), "users");
    assert.equal(renamedColumn("users", "email"), "email");
    assert.equal(legacyColumnOf("users", "email"), "email");
  });
});
