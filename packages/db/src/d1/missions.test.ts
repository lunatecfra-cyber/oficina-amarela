import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Missions } from "./missions.ts";
import { applyD1Schema } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 de missões e consultas", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-missions-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1DatabaseLike;
  let repo: ReturnType<typeof createD1Missions>;

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db, schema);
    repo = createD1Missions(db);
  });

  beforeEach(async () => {
    await db.prepare("DELETE FROM ofertas").run();
    await db.prepare("DELETE FROM pautas").run();
    await db.prepare("DELETE FROM users").run();
  });

  after(() => miniflare.dispose());

  test("criação e listagem de missões por porta-voz e pública", async () => {
    const sp = await db
      .prepare(
        "INSERT INTO users (apelido, nome, email, papel, perfil_completo) VALUES (?, ?, ?, ?, 1) RETURNING id",
      )
      .bind("candidato1", "Candidato Um", "cand1@teste.local", "voz")
      .first<{ id: number }>();
    const spId = Number(sp?.id);

    const created = await repo.createMission({
      spokespersonId: spId,
      title: "Vídeo Campanha Saúde",
      format: "short",
      driveLink: "https://drive.google.com/test",
      tone: "Informativo",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const missionId = created.id;
    const mission = await repo.getMissionById(missionId);
    assert.ok(mission);
    assert.equal(mission?.title, "Vídeo Campanha Saúde");
    assert.equal(mission?.status, "disponivel");

    const spMissions = await repo.getSpokespersonMissions(spId);
    assert.equal(spMissions.length, 1);
    assert.equal(spMissions[0].id, `db-${missionId}`);

    const publicMissions = await repo.getPublicCandidateMissions("candidato1");
    assert.equal(publicMissions.length, 1);

    const queuePos = await repo.getQueuePosition(missionId);
    assert.equal(queuePos, 1);

    const totalQueue = await repo.getTotalInQueue();
    assert.equal(totalQueue, 1);

    const available = await repo.getAvailableMissions();
    assert.equal(available.length, 1);

    const deleted = await repo.deleteMission(missionId);
    assert.deepEqual(deleted, { ok: true });

    const totalAfterDelete = await repo.getTotalInQueue();
    assert.equal(totalAfterDelete, 0);
  });

  // Regressão: a conformidade eleitoral existia só no PostgreSQL. O D1 aceitava
  // a missão, respondia ok e descartava marca d'água, CNPJ, número na urna e
  // título de eleitor — sem erro nenhum, e é justamente o que a tarja estampa.
  test("missão guarda a conformidade eleitoral no D1", async () => {
    const sp = await db
      .prepare(
        "INSERT INTO users (apelido, nome, email, papel, perfil_completo) VALUES (?, ?, ?, ?, 1) RETURNING id",
      )
      .bind("candidato9", "Candidato Nove", "cand9@teste.local", "voz")
      .first<{ id: number }>();

    const created = await repo.createMission({
      spokespersonId: Number(sp?.id),
      title: "Vídeo com tarja",
      format: "short",
      watermark: "Marca d'água",
      campaignTaxId: "12.345.678/0001-90",
      candidateNumber: "5510",
      voterId: "123456789012",
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const mission = await repo.getMissionById(created.id);
    assert.equal(mission?.watermark, "Marca d'água");
    assert.equal(mission?.campaignTaxId, "12.345.678/0001-90");
    assert.equal(mission?.candidateNumber, "5510");
    assert.equal(mission?.voterId, "123456789012");
  });
});
