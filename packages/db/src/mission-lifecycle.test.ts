import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("ciclo de vida da missão", { skip }, async () => {
  const { sql } = await import("./client.ts");
  const { postgresMissionLifecycle: missions } = await import("./mission-lifecycle.ts");

  let spokespersonId: number;
  let editorId: number;

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    await Promise.all(Array.from({ length: 4 }, () => sql`SELECT 1`));
    await sql`TRUNCATE ofertas, pautas, users RESTART IDENTITY CASCADE`;

    const [spokesperson] = await sql`
      INSERT INTO users (apelido, nome, email, papel)
      VALUES ('voz.ciclo', 'Voz Ciclo', 'voz.ciclo@teste.local', 'voz') RETURNING id
    `;
    spokespersonId = spokesperson.id;

    const [editor] = await sql`
      INSERT INTO users (apelido, nome, email, papel)
      VALUES ('editor.ciclo', 'Editor Ciclo', 'editor.ciclo@teste.local', 'editor') RETURNING id
    `;
    editorId = editor.id;
  });

  after(async () => {
    await sql`TRUNCATE ofertas, pautas, users RESTART IDENTITY CASCADE`;
    await sql.end();
  });

  async function createMission(status: string, reservedBy: number | null = null) {
    const [mission] = await sql`
      INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id)
      VALUES (${spokespersonId}, 'Missão do ciclo', 'short', ${status}, ${reservedBy})
      RETURNING id
    `;
    return mission.id as number;
  }

  test("só uma entrega concorrente vence a transição", async () => {
    const missionId = await createMission("reservada", editorId);

    const results = await Promise.all([
      missions.submitDelivery(missionId, editorId, {
        link: "https://video.example/um",
        videoUrl: null,
      }),
      missions.submitDelivery(missionId, editorId, {
        link: "https://video.example/dois",
        videoUrl: null,
      }),
    ]);

    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok).length, 1);
    assert.equal(
      (results.find((result) => !result.ok) as { reason: string }).reason,
      "mission_not_held",
    );
  });

  test("distingue missão inexistente de estado inválido", async () => {
    assert.deepEqual(await missions.finishMission(999_999, spokespersonId), {
      ok: false,
      reason: "mission_not_found",
    });

    const missionId = await createMission("em_revisao", editorId);
    assert.deepEqual(await missions.finishMission(missionId, spokespersonId), {
      ok: false,
      reason: "mission_not_awaiting_spokesperson",
    });
  });

  test("reedição exige observação e preserva quem pediu", async () => {
    const missionId = await createMission("em_revisao", editorId);
    assert.deepEqual(await missions.requestInspectorRevision(missionId, "  "), {
      ok: false,
      reason: "revision_notes_required",
    });
    assert.deepEqual(await missions.requestInspectorRevision(missionId, "  Ajustar cortes  "), {
      ok: true,
    });

    const [mission] = await sql`
      SELECT status, notas_inspetor, reedicao_pedida_por FROM pautas WHERE id = ${missionId}
    `;
    assert.deepEqual(mission, {
      status: "reedicao",
      notas_inspetor: "Ajustar cortes",
      reedicao_pedida_por: "inspetor",
    });
  });
});
