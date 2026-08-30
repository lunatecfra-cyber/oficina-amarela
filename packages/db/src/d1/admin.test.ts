import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Admin } from "./admin.ts";
import { applyD1Schema } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 de administração e fiscalização", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-admin-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1DatabaseLike;
  let repo: ReturnType<typeof createD1Admin>;

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db, schema);
    repo = createD1Admin(db);
  });

  beforeEach(async () => {
    await db.prepare("DELETE FROM denuncias").run();
    await db.prepare("DELETE FROM ofertas").run();
    await db.prepare("DELETE FROM pautas").run();
    await db.prepare("DELETE FROM users").run();
  });

  after(() => miniflare.dispose());

  test("busca, detalhes, banimento e desbanimento de usuários", async () => {
    const u1 = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("editor.alfa", "Alfa Editor", "alfa@editor.local", "editor")
      .first<{ id: number }>();
    const userId = Number(u1?.id);

    const search = await repo.searchUsers("alfa");
    assert.equal(search.length, 1);
    assert.equal(search[0].handle, "editor.alfa");

    const details = await repo.viewUserDetails(userId);
    assert.ok(details);
    assert.equal(details?.name, "Alfa Editor");
    assert.equal(details?.isBanned, false);

    const banResult = await repo.banUser(userId, "Violação de regras");
    assert.deepEqual(banResult, { ok: true });

    const bannedDetails = await repo.viewUserDetails(userId);
    assert.equal(bannedDetails?.isBanned, true);
    assert.equal(bannedDetails?.banReason, "Violação de regras");

    const unbanResult = await repo.unbanUser(userId);
    assert.deepEqual(unbanResult, { ok: true });

    const unbannedDetails = await repo.viewUserDetails(userId);
    assert.equal(unbannedDetails?.isBanned, false);
  });

  test("denúncias e visão geral do sistema", async () => {
    const sp = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("voz1", "Voz Um", "voz1@teste.local", "voz")
      .first<{ id: number }>();
    const ed = await db
      .prepare(
        "INSERT INTO users (apelido, nome, email, papel, perfil_completo) VALUES (?, ?, ?, ?, 1) RETURNING id",
      )
      .bind("ed1", "Editor Um", "ed1@teste.local", "editor")
      .first<{ id: number }>();
    const pauta = await db
      .prepare(
        "INSERT INTO pautas (porta_voz_id, titulo, formato, status) VALUES (?, ?, ?, ?) RETURNING id",
      )
      .bind(Number(sp?.id), "Pauta 1", "curto", "disponivel")
      .first<{ id: number }>();

    await db
      .prepare(
        "INSERT INTO denuncias (pauta_id, denunciante_id, denunciado_id, texto, status) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(Number(pauta?.id), Number(sp?.id), Number(ed?.id), "Entrega com atraso", "aberta")
      .run();

    const reports = await repo.reportsForInspector();
    assert.equal(reports.length, 1);
    assert.equal(reports[0].missionTitle, "Pauta 1");
    assert.equal(reports[0].status, "open");

    const resolveRes = await repo.resolveReport(reports[0].id, "resolved");
    assert.deepEqual(resolveRes, { ok: true });

    const overview = await repo.getSystemOverview();
    assert.equal(overview.inQueue, 1);
    assert.equal(overview.spokespersons, 1);
    assert.equal(overview.editors, 1);
    assert.equal(overview.freeEditors, 1);
  });
});
