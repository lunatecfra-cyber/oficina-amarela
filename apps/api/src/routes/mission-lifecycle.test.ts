import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";
import type { Bindings } from "../app.ts";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("ciclo de vida da missão na API", { skip }, async () => {
  const { sql } = await import("@oficina/db/client");
  const { COOKIE_NAME, createSessionToken } = await import("@oficina/auth/session");
  const { createApp } = await import("../app.ts");

  const app = createApp();
  let spokespersonId: number;
  let otherSpokespersonId: number;
  let editorId: number;
  let otherEditorId: number;
  let adminId: number;
  let spokespersonCookie: string;
  let otherSpokespersonCookie: string;
  let editorCookie: string;
  let otherEditorCookie: string;
  let adminCookie: string;

  const call = (
    missionId: number,
    body: Record<string, unknown>,
    cookie?: string,
    bindings: Bindings = {},
  ) =>
    app.request(
      `http://api.local/missions/db-${missionId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify(body),
      },
      bindings,
    );

  const errorOf = async (response: Response) =>
    ((await response.json()) as { error: string }).error;

  async function cookieFor(id: number, handle: string, role: "editor" | "spokesperson" | "admin") {
    return `${COOKIE_NAME}=${await createSessionToken({ id, handle, name: handle, role })}`;
  }

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  beforeEach(async () => {
    await sql`TRUNCATE fila_emails, gamificacao_eventos, ofertas, pautas, users RESTART IDENTITY CASCADE`;

    const users = await sql`
      INSERT INTO users (apelido, nome, email, papel)
      VALUES
        ('voz.api.ciclo', 'Voz API Ciclo', 'voz.ciclo@teste.local', 'voz'),
        ('voz.api.outra', 'Outra Voz API', 'outra.voz@teste.local', 'voz'),
        ('editor.api.ciclo', 'Editor API Ciclo', 'editor.ciclo@teste.local', 'editor'),
        ('editor.api.outro', 'Outro Editor API', 'outro.editor@teste.local', 'editor'),
        ('admin.api.ciclo', 'Admin API Ciclo', 'admin.ciclo@teste.local', 'admin')
      RETURNING id
    `;
    [spokespersonId, otherSpokespersonId, editorId, otherEditorId, adminId] = users.map(
      (user) => user.id as number,
    );

    spokespersonCookie = await cookieFor(spokespersonId, "voz.api.ciclo", "spokesperson");
    otherSpokespersonCookie = await cookieFor(otherSpokespersonId, "voz.api.outra", "spokesperson");
    editorCookie = await cookieFor(editorId, "editor.api.ciclo", "editor");
    otherEditorCookie = await cookieFor(otherEditorId, "editor.api.outro", "editor");
    adminCookie = await cookieFor(adminId, "admin.api.ciclo", "admin");
  });

  after(async () => {
    await sql`TRUNCATE fila_emails, gamificacao_eventos, ofertas, pautas, users RESTART IDENTITY CASCADE`;
    await sql.end();
  });

  async function createMission(status: string, reservedBy: number | null = null) {
    const [mission] = await sql`
      INSERT INTO pautas (porta_voz_id, titulo, formato, status, reservada_por_id)
      VALUES (${spokespersonId}, 'Missão da API', 'short', ${status}, ${reservedBy})
      RETURNING id
    `;
    return mission.id as number;
  }

  test("sem sessão responde 401 em PT-BR", async () => {
    const response = await call(await createMission("disponivel"), { action: "reserve" });
    assert.equal(response.status, 401);
    assert.equal(await errorOf(response), "Faça login para continuar.");
  });

  test("papel errado responde 403 em PT-BR", async () => {
    const response = await call(
      await createMission("reservada", editorId),
      { action: "deliver", link: "https://video.example/entrega" },
      spokespersonCookie,
    );
    assert.equal(response.status, 403);
    assert.equal(await errorOf(response), "Só editores podem entregar missões.");
  });

  test("editor reserva e libera a missão", async () => {
    const missionId = await createMission("disponivel");
    assert.equal((await call(missionId, { acao: "reservar" }, editorCookie)).status, 200);
    assert.equal((await call(missionId, { action: "cancel" }, editorCookie)).status, 200);

    const [mission] =
      await sql`SELECT status, reservada_por_id FROM pautas WHERE id = ${missionId}`;
    assert.equal(mission.status, "disponivel");
    assert.equal(mission.reservada_por_id, null);
  });

  test("reserva usa o coordenador nomeado pela missão quando o binding existe", async () => {
    const { postgresMissionQueue } = await import("@oficina/db/mission-queue");
    const missionId = await createMission("disponivel");
    let coordinatorName = "";
    const response = await call(missionId, { action: "reserve" }, editorCookie, {
      MISSION_COORDINATOR: {
        idFromName(name) {
          coordinatorName = name;
          return name;
        },
        get() {
          return {
            async fetch(_input, init) {
              const claim = JSON.parse(String(init?.body)) as {
                missionId: number;
                editorId: number;
              };
              return Response.json(
                await postgresMissionQueue.reserveMission(claim.missionId, claim.editorId),
              );
            },
          };
        },
      },
    });

    assert.equal(response.status, 200);
    assert.equal(coordinatorName, `mission:${missionId}`);
  });

  test("entrega válida muda o estado e registra XP uma vez", async () => {
    const missionId = await createMission("reservada", editorId);
    const response = await call(
      missionId,
      { action: "deliver", link: "https://video.example/entrega" },
      editorCookie,
    );
    assert.equal(response.status, 200);

    const [mission] = await sql`SELECT status, entrega_link FROM pautas WHERE id = ${missionId}`;
    const [event] = await sql`
      SELECT regra_id, xp FROM gamificacao_eventos WHERE user_id = ${editorId}
    `;
    assert.equal(mission.status, "em_revisao");
    assert.equal(mission.entrega_link, "https://video.example/entrega");
    assert.deepEqual(event, { regra_id: "missao_entregue", xp: 40 });
  });

  test("entrega rejeita texto que apenas contém o nome do armazenamento", async () => {
    const response = await call(
      await createMission("reservada", editorId),
      { action: "deliver", link: "arquivo-inválido.r2.dev" },
      editorCookie,
    );
    assert.equal(response.status, 400);
    assert.equal(await errorOf(response), "Cole o link do vídeo editado ou faça o upload.");
  });

  test("estado inválido e posse obsoleta respondem 409 em PT-BR", async () => {
    const available = await createMission("disponivel");
    const invalidState = await call(
      available,
      { action: "deliver", link: "https://video.example/entrega" },
      editorCookie,
    );
    assert.equal(invalidState.status, 409);
    assert.equal(await errorOf(invalidState), "Essa missão não está com você.");

    const reserved = await createMission("reservada", editorId);
    const staleOwner = await call(
      reserved,
      { action: "deliver", link: "https://video.example/entrega" },
      otherEditorCookie,
    );
    assert.equal(staleOwner.status, 409);
    assert.equal(await errorOf(staleOwner), "Essa missão não está com você.");
  });

  test("inspetor pede reedição e observação vazia falha no limite HTTP", async () => {
    const missingNotes = await call(
      await createMission("em_revisao", editorId),
      { action: "re_edit", notes: " " },
      adminCookie,
    );
    assert.equal(missingNotes.status, 400);
    assert.equal(await errorOf(missingNotes), "Escreva o que precisa mudar.");

    const missionId = await createMission("em_revisao", otherEditorId);
    assert.equal(
      (await call(missionId, { action: "re_edit", notes: "Corrigir o áudio" }, adminCookie)).status,
      200,
    );
    const [mission] = await sql`
      SELECT status, reedicao_pedida_por FROM pautas WHERE id = ${missionId}
    `;
    assert.deepEqual(mission, { status: "reedicao", reedicao_pedida_por: "inspetor" });
  });

  test("só a dona conclui ou pede ajuste na entrega", async () => {
    const approved = await createMission("aprovada", editorId);
    const wrongOwner = await call(approved, { action: "accept" }, otherSpokespersonCookie);
    assert.equal(wrongOwner.status, 409);
    assert.equal(await errorOf(wrongOwner), "Essa missão não está aguardando sua conferência.");
    assert.equal((await call(approved, { action: "accept" }, spokespersonCookie)).status, 200);

    const review = await createMission("em_revisao", otherEditorId);
    assert.equal(
      (await call(review, { action: "adjust", notes: "Trocar a abertura" }, spokespersonCookie))
        .status,
      200,
    );
    const [mission] = await sql`
      SELECT status, reedicao_pedida_por FROM pautas WHERE id = ${review}
    `;
    assert.deepEqual(mission, { status: "reedicao", reedicao_pedida_por: "porta_voz" });
  });

  test("aprovação exige inspetor ou porta-voz proprietária", async () => {
    const missionId = await createMission("em_revisao", editorId);
    const editor = await call(missionId, { action: "approve", rating: 5 }, editorCookie);
    assert.equal(editor.status, 403);

    const wrongOwner = await call(
      missionId,
      { action: "approve", rating: 5 },
      otherSpokespersonCookie,
    );
    assert.equal(wrongOwner.status, 403);
    assert.equal(await errorOf(wrongOwner), "Você não pode aprovar esta missão.");
  });

  test("aprovação via Hono é idempotente e responde em PT-BR", async () => {
    const missionId = await createMission("em_revisao", editorId);
    assert.equal(
      (await call(missionId, { acao: "aprovar", nota: 5, comentario: "Ótimo" }, adminCookie))
        .status,
      200,
    );
    assert.equal(
      (await call(missionId, { action: "approve", rating: 5 }, adminCookie)).status,
      200,
    );
    const [state] = await sql`
      SELECT
        (SELECT status FROM pautas WHERE id = ${missionId}) AS status,
        (SELECT count(*)::int FROM avaliacoes WHERE pauta_id = ${missionId}) AS avaliacoes,
        (SELECT entregues FROM users WHERE id = ${editorId}) AS entregues
    `;
    assert.deepEqual(state, { status: "aprovada", avaliacoes: 1, entregues: 1 });

    const invalid = await call(
      await createMission("em_revisao", otherEditorId),
      { action: "approve", rating: 5.5 },
      adminCookie,
    );
    assert.equal(invalid.status, 400);
    assert.equal(await errorOf(invalid), "A nota deve ser um número inteiro de 1 a 5.");
  });
});
