import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

describe("ensaio de migração PostgreSQL → D1", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql } = await import("../client.ts");
  const { applyD1Tables, applyD1Triggers } = await import("../d1/schema.ts");
  const { backfillD1EventTables, migrateToD1, toSqliteValue } = await import("./pg-to-d1.ts");
  const { validateMigration } = await import("./validate.ts");
  type D1 = import("../d1/types.ts").D1DatabaseLike;

  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-migration-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1;
  let schema: string;
  let spokespersonId: number;
  let editorId: number;
  let adminId: number;
  let missionId: number;
  let cycleId: number;

  const MARK = "%@ensaio.local";

  async function cleanupPostgres() {
    await sql`DELETE FROM convites_porta_voz WHERE email LIKE ${MARK}`;
    await sql`DELETE FROM ranking_aprovacoes WHERE editor_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM avaliacoes WHERE editor_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM ranking_ciclos WHERE nome = 'Ciclo do ensaio'`;
    await sql`DELETE FROM pautas WHERE porta_voz_id IN (
        SELECT id FROM users WHERE email LIKE ${MARK})`;
    await sql`DELETE FROM users WHERE email LIKE ${MARK}`;
  }

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1;
    schema = await readFile(new URL("../../d1/0001_mission_slice.sql", import.meta.url), "utf8");

    await cleanupPostgres();
    const [spokesperson] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel)
        VALUES ('voz.ensaio', 'Voz Ensaio', 'voz@ensaio.local', 'x', 'voz') RETURNING id`;
    spokespersonId = Number(spokesperson.id);
    const [admin] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel)
        VALUES ('adm.ensaio', 'Admin Ensaio', 'adm@ensaio.local', 'x', 'admin') RETURNING id`;
    adminId = Number(admin.id);
    // O editor foi indicado pela voz: cobre a coluna auto-referente.
    const [editor] = await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel, indicado_por_id, entregues)
        VALUES ('ed.ensaio', 'Editor Ensaio', 'ed@ensaio.local', 'x', 'editor',
                ${spokespersonId}, 1)
        RETURNING id`;
    editorId = Number(editor.id);

    const [mission] = await sql`
        INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id, pontuada)
        VALUES (${spokespersonId}, 'Missão do ensaio', 'short', 'aprovada', ${editorId}, true)
        RETURNING id`;
    missionId = Number(mission.id);

    // A missão já pontuou: precisa da aprovação no ranking e da avaliação,
    // senão o próprio estado de origem está inconsistente.
    const [cycle] = await sql`
        INSERT INTO ranking_ciclos (nome, termina_em, criado_por)
        VALUES ('Ciclo do ensaio', now() + interval '30 days', ${adminId}) RETURNING id`;
    cycleId = Number(cycle.id);
    await sql`
        INSERT INTO ranking_aprovacoes (pauta_id, ciclo_id, editor_id, aprovado_por)
        VALUES (${missionId}, ${cycleId}, ${editorId}, ${adminId})`;
    await sql`
        INSERT INTO avaliacoes (pauta_id, editor_id, nota, comentario)
        VALUES (${missionId}, ${editorId}, 5, 'Ficou ótimo')`;

    await sql`
        INSERT INTO convites_porta_voz (email, token_hash, criado_por, expira_em, usado_em, usado_por)
        VALUES ('voz@ensaio.local', ${"e".repeat(64)}, ${adminId},
                now() + interval '7 days', now(), ${spokespersonId})`;
  });

  after(async () => {
    await cleanupPostgres();
    await miniflare.dispose();
  });

  test("ensaio a seco não escreve nada e ainda assim conta a origem", async () => {
    await applyD1Tables(db, schema);
    const report = await migrateToD1(sql as never, db, { dryRun: true });
    assert.equal(report.dryRun, true);

    const users = report.tables.find((entry) => entry.table === "users");
    assert.ok((users?.source ?? 0) >= 3, "a origem precisa ter sido lida");
    assert.equal(users?.loaded, 0);
    assert.equal(users?.target, 0);
    assert.equal(users?.skipped, 0, "a seco não pula nada: apenas não grava");

    const total = await db.prepare("SELECT count(*) AS total FROM users").first<{
      total: number;
    }>();
    assert.equal(Number(total?.total), 0, "a seco não pode gravar");
  });

  test("carga leva as linhas, resolve a auto-referência e liga os gatilhos depois", async () => {
    const report = await migrateToD1(sql as never, db);
    assert.equal(report.dryRun, false);
    assert.ok((report.tables.find((entry) => entry.table === "users")?.loaded ?? 0) >= 3);

    const editor = await db
      .prepare("SELECT indicado_por_id FROM users WHERE apelido = 'ed.ensaio'")
      .first<{ indicado_por_id: number }>();
    assert.equal(Number(editor?.indicado_por_id), spokespersonId);

    const events = await backfillD1EventTables(sql as never, db);
    assert.equal(events.find((entry) => entry.table === "mission_approvals")?.loaded, 1);
    assert.equal(events.find((entry) => entry.table === "invitation_redemptions")?.loaded, 1);

    // Antes dos gatilhos, o backfill não pode ter reaplicado efeito nenhum:
    // o editor continua com a entrega única que já tinha no PostgreSQL.
    const scored = await db
      .prepare("SELECT entregues FROM users WHERE apelido = 'ed.ensaio'")
      .first<{ entregues: number }>();
    assert.equal(Number(scored?.entregues), 1, "o backfill não pode pontuar de novo");

    await applyD1Triggers(db, schema);
  });

  test("com gatilho ligado, o backfill se recusa em vez de contar duas vezes", async () => {
    await assert.rejects(
      () => backfillD1EventTables(sql as never, db),
      /gatilhos de evento já estão ligados/,
    );
  });

  test("repetir a carga é seguro: não duplica nem falha", async () => {
    const before = await db.prepare("SELECT count(*) AS total FROM users").first<{
      total: number;
    }>();
    const report = await migrateToD1(sql as never, db);
    const after = await db.prepare("SELECT count(*) AS total FROM users").first<{
      total: number;
    }>();

    assert.equal(Number(after?.total), Number(before?.total));
    assert.equal(report.tables.find((entry) => entry.table === "users")?.loaded, 0);
    assert.ok((report.tables.find((entry) => entry.table === "users")?.skipped ?? 0) > 0);
  });

  test("a conferência não acha divergência depois de uma migração completa", async () => {
    const discrepancies = await validateMigration(sql as never, db);
    assert.deepEqual(discrepancies, []);
  });

  test("a conferência acusa linha que ficou para trás", async () => {
    await db.prepare("DELETE FROM mensagens").run();
    await db.prepare("DELETE FROM pautas WHERE id = ?").bind(missionId).run();

    const discrepancies = await validateMigration(sql as never, db);
    const counted = discrepancies.find(
      (entry) => entry.table === "pautas" && entry.kind === "contagem",
    );
    const missing = discrepancies.find(
      (entry) => entry.table === "pautas" && entry.kind === "ausente",
    );
    assert.ok(counted, `esperava divergência de contagem: ${JSON.stringify(discrepancies)}`);
    assert.ok(missing);
    assert.match(missing.detail, new RegExp(String(missionId)));
  });

  test("a conversão de tipo respeita o que o SQLite guarda", () => {
    assert.equal(toSqliteValue(new Date("2026-08-30T12:00:00.000Z")), "2026-08-30T12:00:00.000Z");
    assert.equal(toSqliteValue(true), 1);
    assert.equal(toSqliteValue(false), 0);
    assert.equal(toSqliteValue(null), null);
    assert.equal(toSqliteValue(undefined), null);
    assert.equal(toSqliteValue({ motivo: "x" }), '{"motivo":"x"}');
    assert.equal(toSqliteValue(7), 7);
  });
});
