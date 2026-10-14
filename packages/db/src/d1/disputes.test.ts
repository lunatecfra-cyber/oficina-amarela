import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createApp } from "../../../../apps/api/src/app.ts";
import { d1ApiDependencies } from "../../../../apps/api/src/dependencies.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

const mf = new Miniflare(
  convertV4MiniflareOptions({
    compatibilityDate: "2026-08-30",
    d1Databases: { DB: "disputes" },
    r2Buckets: { MEDIA: "disputes" },
    modules: true,
    script: "export default {fetch(){return new Response('ok')}}",
  }),
);
let db: Awaited<ReturnType<typeof mf.getD1Database>>,
  media: Awaited<ReturnType<typeof mf.getR2Bucket>>,
  app: ReturnType<typeof createApp>;
const cookies: Record<number, string> = {};
const env = () => ({
  DB: db,
  MEDIA: media as never,
  BACKGROUND_QUEUE: { async send() {} },
  STAGING_EMAIL_SIMULATED: "true",
});
const call = (path: string, actor?: number, method = "GET", body?: unknown) =>
  app.request(
    `https://staging.local/disputes${path}`,
    {
      method,
      headers: { cookie: actor ? (cookies[actor] ?? "") : "", "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    env(),
  );
const upload = (path: string, actor: number, file: Blob, text: string) => {
  const form = new FormData();
  form.set("file", file, "prova.png");
  form.set("text", text);
  return app.request(
    `https://staging.local/disputes${path}`,
    { method: "POST", headers: { cookie: cookies[actor] ?? "" }, body: form },
    env(),
  );
};
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9];
const CLAIM = "A entrega não seguiu o briefing combinado.";
const open = async (actor: number, missionId: number) =>
  call("", actor, "POST", { missionId, category: "quality", claim: CLAIM });
type Case = {
  status: string;
  decisions: { round: number; outcome: string; rationale: string }[];
  appeal: { requestedById: number } | null;
  statements: { authorKind: string; attachments: { id: number }[] }[];
  can: Record<string, boolean>;
};
const caseOf = async (id: number, actor: number) =>
  ((await (await call(`/${id}`, actor)).json()) as { dispute: Case }).dispute;

before(async () => {
  process.env.AUTH_SECRET = "disputes-isolated-secret";
  db = await mf.getD1Database("DB");
  media = await mf.getR2Bucket("MEDIA");
  await applyAllD1Migrations(db as unknown as D1DatabaseLike);
  app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  for (const [id, role] of [
    [1, "spokesperson"],
    [2, "editor"],
    [3, "inspector"], // mediador
    [4, "admin"], // concede mediação
    [5, "admin"], // revisor do recurso
    [6, "inspector"], // sem concessão
    [7, "editor"], // fora das missões
    [8, "inspector"], // mediador, mas parte na missão 3
    [9, "editor"],
  ] as const) {
    await db
      .prepare("INSERT INTO users(id,handle,name,email,role,profile_completed) VALUES(?,?,?,?,?,1)")
      .bind(
        id,
        `disp${id}`,
        `Disp ${id}`,
        `disp${id}@example.invalid`,
        role === "spokesperson" ? "voz" : role,
      )
      .run();
    cookies[id] =
      `${COOKIE_NAME}=${await createSessionToken({ id, role, handle: `disp${id}`, name: `Disp ${id}` })}`;
  }
  await db
    .prepare(
      "INSERT INTO missions(id,spokesperson_id,reserved_by_id,title,format,status) VALUES(1,1,2,'M1','short','reservada'),(2,1,9,'M2','short','reservada'),(3,1,8,'M3','short','reservada')",
    )
    .run();
  await db.prepare("INSERT INTO dispute_mediators(user_id) VALUES(8)").run();
});
after(() => mf.dispose());

test("ciclo completo: abertura, manifestações, mediação, decisão, recurso e encerramento", async () => {
  // abertura: só as partes, com campos válidos
  assert.equal((await open(0 as never, 1)).status, 401);
  assert.equal((await open(7, 1)).status, 403);
  assert.equal(
    (await call("", 1, "POST", { missionId: 1, category: "nope", claim: CLAIM })).status,
    400,
  );
  assert.equal(
    (await call("", 1, "POST", { missionId: 1, category: "quality", claim: "curta" })).status,
    400,
  );
  const created = await open(1, 1);
  assert.equal(created.status, 201);
  const { id } = (await created.json()) as { id: number };
  // uma disputa viva por missão, mesmo se a outra parte tentar
  assert.equal((await open(2, 1)).status, 409);

  // captura no momento da abertura, só para a equipe
  const evidence = await call(`/${id}/evidence`, 6);
  assert.equal(evidence.status, 200);
  const kinds = new Set(
    ((await evidence.json()) as { evidence: { kind: string }[] }).evidence.map((e) => e.kind),
  );
  assert.ok(["mission", "participant"].every((k) => kinds.has(k)));
  assert.equal((await call(`/${id}/evidence`, 1)).status, 403);
  assert.equal((await call(`/${id}/evidence`, 7)).status, 403);

  // visibilidade da lista
  const listed = async (actor: number) =>
    ((await (await call("", actor)).json()) as { disputes: { id: number }[] }).disputes.length;
  assert.deepEqual(
    [await listed(1), await listed(2), await listed(7), await listed(6)],
    [1, 1, 0, 1],
  );
  assert.equal((await call(`/${id}`, 7)).status, 403);

  // manifestações: as partes, com arquivo opcional; estranhos não
  assert.equal(
    (await call(`/${id}/statements`, 2, "POST", { text: "O briefing mudou depois." })).status,
    201,
  );
  assert.equal((await call(`/${id}/statements`, 7, "POST", { text: "intruso" })).status, 403);
  const png = new Blob([new Uint8Array(PNG)], { type: "image/png" });
  const withFile = await upload(`/${id}/statements`, 1, png, "Segue a referência original.");
  assert.equal(withFile.status, 201);
  assert.equal((await upload(`/${id}/statements`, 7, png, "x")).status, 403);
  const files = (await caseOf(id, 2)).statements.flatMap((s) => s.attachments);
  assert.equal(files.length, 1);
  const download = await call(`/${id}/attachments/${files[0]?.id}`, 2);
  assert.equal(download.status, 200);
  assert.deepEqual([...new Uint8Array(await download.arrayBuffer())], PNG);
  assert.equal((await call(`/${id}/attachments/${files[0]?.id}`, 7)).status, 403);
  assert.equal((await call(`/999/attachments/${files[0]?.id}`, 1)).status, 404);

  // mediação: precisa de concessão; parte, não concedido e quem vem do papel não assumem
  assert.equal((await call(`/${id}/take`, 6, "POST")).status, 403);
  assert.equal((await call(`/${id}/take`, 2, "POST")).status, 403);
  assert.equal((await call("/mediators/3", 3, "PUT")).status, 403);
  assert.equal((await call("/mediators/7", 4, "PUT")).status, 400); // editor não media
  assert.equal((await call("/mediators/3", 4, "PUT")).status, 200);
  assert.equal((await call(`/${id}/take`, 3, "POST")).status, 200);
  assert.equal((await call(`/${id}/take`, 3, "POST")).status, 409); // já está em análise
  assert.equal((await caseOf(id, 3)).can.decide, true);

  // decisão: só o mediador da rodada, com campos válidos e sem conflito
  const verdict = {
    outcome: "partially_upheld",
    rationale: "Parte do pedido procede pelo briefing.",
  };
  assert.equal((await call(`/${id}/decision`, 1, "POST", verdict)).status, 403);
  assert.equal((await call(`/${id}/decision`, 6, "POST", verdict)).status, 403);
  assert.equal(
    (await call(`/${id}/decision`, 3, "POST", { ...verdict, outcome: "x" })).status,
    400,
  );
  assert.equal(
    (await call(`/${id}/decision`, 3, "POST", { ...verdict, rationale: "curto" })).status,
    400,
  );
  assert.equal((await call(`/${id}/decision`, 3, "POST", verdict)).status, 200);
  assert.equal((await call(`/${id}/decision`, 3, "POST", verdict)).status, 200); // repetição idêntica
  assert.equal(
    (await call(`/${id}/decision`, 3, "POST", { ...verdict, outcome: "dismissed" })).status,
    409,
  );
  // depois de decidida não entram mais manifestações
  assert.equal((await call(`/${id}/statements`, 1, "POST", { text: "tarde demais" })).status, 409);

  // recurso: uma das partes, uma vez
  const appealBody = { reason: "A decisão desconsiderou a referência enviada." };
  assert.equal((await call(`/${id}/appeal`, 7, "POST", appealBody)).status, 403);
  assert.equal((await call(`/${id}/appeal`, 3, "POST", appealBody)).status, 403);
  assert.equal((await call(`/${id}/appeal`, 1, "POST", { reason: "curto" })).status, 400);
  assert.equal((await call(`/${id}/appeal`, 1, "POST", appealBody)).status, 201);
  assert.equal((await call(`/${id}/appeal`, 2, "POST", appealBody)).status, 409);

  // revisão: não pode ser o mesmo mediador nem quem só tem a concessão de mediar
  assert.equal((await call(`/${id}/take`, 3, "POST")).status, 403);
  assert.equal((await call(`/${id}/take`, 5, "POST")).status, 200);
  assert.equal((await call(`/${id}/decision`, 3, "POST", verdict)).status, 403);
  const final = {
    outcome: "dismissed",
    rationale: "Em revisão, o briefing original prevalece.",
    recommendation: "Sem ação.",
  };
  assert.equal((await call(`/${id}/decision`, 5, "POST", final)).status, 200);

  // histórico preservado: as duas decisões, na ordem, e o recurso
  const done = await caseOf(id, 1);
  assert.equal(done.status, "closed");
  assert.deepEqual(
    done.decisions.map((d) => [d.round, d.outcome]),
    [
      [1, "partially_upheld"],
      [2, "dismissed"],
    ],
  );
  assert.equal(done.appeal?.requestedById, 1);
  await assert.rejects(
    db
      .prepare("UPDATE dispute_decisions SET outcome = 'upheld' WHERE dispute_id = ?")
      .bind(id)
      .run(),
    /dispute_immutable/,
  );
  await assert.rejects(
    db.prepare("DELETE FROM disputes WHERE id = ?").bind(id).run(),
    /evidence_retained/,
  );
  await assert.rejects(db.prepare("DELETE FROM missions WHERE id = 1").run(), /evidence_retained/);
  // a conta de quem participa não é apagada enquanto o caso existe
  const del = await app.request(
    "https://staging.local/account",
    {
      method: "DELETE",
      headers: { cookie: cookies[2] ?? "", "content-type": "application/json" },
      body: JSON.stringify({ confirmation: "disp2" }),
    },
    env(),
  );
  assert.equal(del.status, 409);

  // trilha de auditoria: abertura, assunções, decisões, recurso, mediação concedida
  const audit = await db
    .prepare("SELECT action FROM admin_audit WHERE entity='dispute' AND entity_id = ? ORDER BY id")
    .bind(String(id))
    .all<{ action: string }>();
  assert.deepEqual(
    audit.results.map((a) => a.action),
    [
      "disputa_aberta",
      "disputa_assumida",
      "disputa_decidida",
      "disputa_recurso",
      "disputa_assumida",
      "disputa_decidida",
    ],
  );
  // encerrada, a missão deixa de aparecer como disputada
  assert.equal(
    await db.prepare("SELECT 1 FROM disputed_missions WHERE mission_id = 1").first(),
    null,
  );
});

test("quem tem vínculo não julga; concessão revogada vale na hora; encerrar exige justificativa", async () => {
  // missão 3: o editor é o inspetor 8, que tem a concessão de mediar, mas é parte
  const opened = await open(1, 3);
  const { id } = (await opened.json()) as { id: number };
  assert.equal(
    (
      (await db.prepare("SELECT 1 AS d FROM disputed_missions WHERE mission_id = 3").first()) as {
        d: number;
      }
    ).d,
    1,
  );
  assert.equal((await call(`/${id}/take`, 8, "POST")).status, 403);
  assert.equal((await caseOf(id, 8)).can.take, false);

  // mediador 3 assume e depois perde a concessão: não decide mais
  assert.equal((await call(`/${id}/take`, 3, "POST")).status, 200);
  assert.equal((await call("/mediators/3", 4, "DELETE")).status, 200);
  const verdict = { outcome: "upheld", rationale: "Procede integralmente pelo registro." };
  assert.equal((await call(`/${id}/decision`, 3, "POST", verdict)).status, 403);
  assert.equal((await call("/mediators/3", 4, "PUT")).status, 200);
  assert.equal((await call(`/${id}/decision`, 3, "POST", verdict)).status, 200);

  // encerrar sem recurso: justificativa, capacidade de decidir e sem vínculo
  assert.equal((await call(`/${id}/close`, 5, "POST", { reason: "curto" })).status, 400);
  assert.equal(
    (await call(`/${id}/close`, 3, "POST", { reason: "Prazo de recurso encerrado." })).status,
    403,
  );
  assert.equal(
    (await call(`/${id}/close`, 1, "POST", { reason: "Prazo de recurso encerrado." })).status,
    403,
  );
  assert.equal(
    (await call(`/${id}/close`, 5, "POST", { reason: "Prazo de recurso encerrado." })).status,
    200,
  );
  assert.equal((await caseOf(id, 1)).status, "closed");
  const acts = await db
    .prepare("SELECT action FROM admin_audit WHERE entity='dispute' AND entity_id = ? ORDER BY id")
    .bind(String(id))
    .all<{ action: string }>();
  assert.equal(acts.results.at(-1)?.action, "disputa_encerrada");
});
