import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Profiles } from "./profiles.ts";
import { applyD1Schema } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("paridade D1 de perfis e onboarding", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-profiles-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1DatabaseLike;
  let repo: ReturnType<typeof createD1Profiles>;

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    const schema = await readFile(
      new URL("../../d1/0001_mission_slice.sql", import.meta.url),
      "utf8",
    );
    await applyD1Schema(db, schema);
    repo = createD1Profiles(db);
  });

  beforeEach(async () => {
    await db.prepare("DELETE FROM ranking_aprovacoes").run();
    await db.prepare("DELETE FROM ranking_ciclos").run();
    await db.prepare("DELETE FROM pautas").run();
    await db.prepare("DELETE FROM portfolio").run();
    await db.prepare("DELETE FROM conquistas").run();
    await db.prepare("DELETE FROM users").run();
  });

  after(() => miniflare.dispose());

  test("leitura e escrita do perfil editável", async () => {
    const created = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("editor1", "Editor Um", "editor1@teste.local", "editor")
      .first<{ id: number }>();
    const userId = Number(created?.id);

    const initial = await repo.readEditableProfile(userId);
    assert.deepEqual(initial, {
      headline: [],
      bio: null,
      location: null,
      localizacao: null,
      hasPassword: false,
      temSenha: false,
    });

    const saved = await repo.saveEditableProfile(userId, {
      headline: ["Cortes rápidos", "Motion"],
      bio: "Editor experiente",
      location: "São Paulo, SP",
    });
    assert.deepEqual(saved, { ok: true });

    const updated = await repo.readEditableProfile(userId);
    assert.deepEqual(updated?.headline, ["Cortes rápidos", "Motion"]);
    assert.equal(updated?.bio, "Editor experiente");
    assert.equal(updated?.location, "São Paulo, SP");
  });

  test("onboarding de editor e grade de disponibilidade", async () => {
    const created = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("editor2", "Editor Dois", "editor2@teste.local", "editor")
      .first<{ id: number }>();
    const userId = Number(created?.id);

    const grid = [
      [true, false, true, false, true, false, false],
      [false, true, false, true, false, true, false],
      [true, true, true, true, true, false, false],
    ];

    const saved = await repo.saveEditorOnboarding(userId, {
      name: "Editor Dois Atualizado",
      avatarUrl: "data:image/png;base64,iVBORw0KGgo=",
      location: "Rio de Janeiro, RJ",
      headline: ["Shorts/Reels", "Storytelling"],
      bio: "Foco em vídeos de alta retenção",
      softwares: ["Premiere", "After Effects"],
      styles: ["Reels dinâmico"],
      portfolioLink: "https://portfolio.me/editor",
      availability: grid,
      editingLevel: "Avançado",
      pcSetup: "🚀 PC Monstro",
      niches: ["Vertical (9:16)"],
    });
    assert.deepEqual(saved, { ok: true });

    const onboarding = await repo.readEditorOnboarding(userId);
    assert.equal(onboarding?.name, "Editor Dois Atualizado");
    assert.equal(onboarding?.location, "Rio de Janeiro, RJ");
    assert.deepEqual(onboarding?.softwares, ["Premiere", "After Effects"]);
    assert.deepEqual(onboarding?.styles, ["Reels dinâmico"]);
    assert.deepEqual(onboarding?.availability, grid);
    assert.equal(onboarding?.profileCompleted, true);

    const scheduleSave = await repo.saveEditorSchedule(userId, grid);
    assert.deepEqual(scheduleSave, { ok: true });

    const invalidSchedule = await repo.saveEditorSchedule(userId, [[true]]);
    assert.equal(invalidSchedule.ok, false);
  });

  test("perfil público do editor e ranking de editores", async () => {
    const editor = await db
      .prepare(
        `INSERT INTO users (
           apelido, nome, email, papel, headline, bio, localizacao, entregues, reputacao, streak,
           nota, softwares, estilos, nicho, nivel_edicao, setup_pc, perfil_completo
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING id`,
      )
      .bind(
        "jr.eneias",
        "Jr. Eneias",
        "jr@teste.local",
        "editor",
        JSON.stringify(["Editor de vídeo", "Cortes"]),
        "Bio do editor",
        "Petrópolis, RJ",
        15,
        350,
        5,
        4.9,
        JSON.stringify(["Premiere", "CapCut"]),
        JSON.stringify(["Reels dinâmico"]),
        JSON.stringify(["Vertical (9:16)"]),
        "Avançado",
        "🚀 PC Monstro",
      )
      .first<{ id: number }>();
    const editorId = Number(editor?.id);

    await db
      .prepare(
        "INSERT INTO portfolio (user_id, titulo, formato, porta_voz, tint, link_video) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(editorId, "Corte 1", "short", "Busnelo", "tint-padrao", "https://youtube.com/watch?v=1")
      .run();

    await db
      .prepare("INSERT INTO conquistas (user_id, nome, icone) VALUES (?, ?, ?)")
      .bind(editorId, "Primeira Entrega", "⚡")
      .run();

    const profile = await repo.readEditorProfile("jr.eneias");
    assert.ok(profile !== null);
    assert.equal(profile.handle, "jr.eneias");
    assert.equal(profile.deliveries, 15);
    assert.equal(profile.portfolio.length, 1);
    assert.equal(profile.portfolio[0].title, "Corte 1");
    assert.equal(profile.achievements.length, 1);
    assert.equal(profile.achievements[0].name, "Primeira Entrega");

    const ranking = await repo.readEditorRanking(10);
    assert.equal(ranking.length, 1);
    assert.equal(ranking[0].handle, "jr.eneias");
    assert.equal(ranking[0].deliveredCount, 15);
  });

  test("onboarding de porta-voz e consultas de candidato", async () => {
    const spokesperson = await db
      .prepare("INSERT INTO users (apelido, nome, email, papel) VALUES (?, ?, ?, ?) RETURNING id")
      .bind("busnelo", "Busnelo", "busnelo@teste.local", "voz")
      .first<{ id: number }>();
    const userId = Number(spokesperson?.id);

    const saved = await repo.saveCandidateOnboarding(userId, {
      name: "Busnelo Oficial",
      photoUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
      politicalOffice: "Deputado Estadual",
      runningFor: "Petrópolis, RJ",
      electionYear: "2026",
      location: "Petrópolis, RJ",
      campaignFlags: ["Segurança", "Comunidade"],
      communicationTone: "Direto e firme",
      keywords: ["Direto", "Firme"],
      socialLinks: { instagram: "@busnelo.oficial" },
      bio: "Bio do Busnelo",
      watermark: "Marca d'água",
      campaignTaxId: "12.345.678/0001-90",
      voterId: "123456789012",
    });
    assert.deepEqual(saved, { ok: true });

    const onboarding = await repo.readCandidateOnboarding(userId);
    assert.equal(onboarding?.name, "Busnelo Oficial");
    assert.equal(onboarding?.politicalOffice, "Deputado Estadual");
    assert.deepEqual(onboarding?.campaignFlags, ["Segurança", "Comunidade"]);
    assert.deepEqual(onboarding?.socialLinks, { instagram: "@busnelo.oficial" });
    assert.equal(onboarding?.profileComplete, true);

    const own = await repo.readOwnCandidate(userId);
    assert.ok(own !== null);
    assert.equal(own.slug, "busnelo");
    assert.equal(own.name, "Busnelo Oficial");
    assert.equal(own.politicalOffice, "Deputado Estadual");

    const pub = await repo.readPublicCandidate("busnelo");
    assert.ok(pub !== null);
    assert.equal(pub.slug, "busnelo");

    const map = await repo.readCandidatesByHandles(["busnelo", "inexistente"]);
    assert.equal(map.size, 1);
    assert.equal(map.get("busnelo")?.name, "Busnelo Oficial");
  });
});
