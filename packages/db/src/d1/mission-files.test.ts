import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { COOKIE_NAME, createSessionToken } from "@oficina/auth/session";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createApp } from "../../../../apps/api/src/app.ts";
import { d1ApiDependencies } from "../../../../apps/api/src/dependencies.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("entrega privada com D1 e R2 reais isolados", () => {
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "mission-files-tests" },
      r2Buckets: { MEDIA: "mission-files-tests" },
      modules: true,
      script: "export default {fetch() {return new Response('ok')}}",
    }),
  );
  let db: Awaited<ReturnType<typeof mf.getD1Database>>;
  let media: Awaited<ReturnType<typeof mf.getR2Bucket>>;
  let app: ReturnType<typeof createApp>;
  const cookies: Record<string, string> = {};
  let missionId: number;
  const call = (
    path: string,
    method = "GET",
    body?: unknown,
    cookie = cookies.editor,
    headers: Record<string, string> = {},
  ) =>
    app.request(
      `https://staging.local${path}`,
      {
        method,
        headers: { cookie, "content-type": "application/json", ...headers },
        ...(body === undefined
          ? {}
          : {
              body: body instanceof Uint8Array ? new Uint8Array(body).buffer : JSON.stringify(body),
            }),
      },
      {
        DB: db,
        MEDIA: media as never,
        BACKGROUND_QUEUE: { async send() {} },
        STAGING_EMAIL_SIMULATED: "true",
        PUBLIC_ORIGIN: "https://staging.local",
        STAGING_INSPECTION_ALL: "true",
      },
    );
  before(async () => {
    process.env.AUTH_SECRET = "mission-files-isolated-test-secret";
    db = await mf.getD1Database("DB");
    media = await mf.getR2Bucket("MEDIA");
    await applyAllD1Migrations(db as unknown as D1DatabaseLike);
    app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
    for (const [id, role, handle] of [
      [1, "spokesperson", "voice"],
      [2, "editor", "editor"],
      [3, "admin", "admin"],
      [4, "editor", "other"],
    ] as const) {
      await db
        .prepare(
          "INSERT INTO users (id,handle,name,email,role,profile_completed) VALUES (?,?,?,?,?,1)",
        )
        .bind(
          id,
          handle,
          handle,
          `${handle}@example.invalid`,
          role === "spokesperson" ? "voz" : role,
        )
        .run();
      cookies[handle] =
        `${COOKIE_NAME}=${await createSessionToken({ id, role, handle, name: handle })}`;
    }
    cookies.reusedHandle = `${COOKIE_NAME}=${await createSessionToken({ id: 4, role: "editor", handle: "editor", name: "Old handle" })}`;
    const mission = await db
      .prepare(
        "INSERT INTO missions (spokesperson_id,title,format,status,reserved_by_id) VALUES (1,'Vídeo','short','reservada',2) RETURNING id",
      )
      .first<{ id: number }>();
    missionId = mission!.id;
  });
  after(() => mf.dispose());
  const prepare = async (size = 3, contentType = "video/mp4") =>
    call(`/missions/${missionId}/uploads`, "POST", {
      filename: "synthetic.mp4",
      contentType,
      size,
    });
  const sendPart = (fileId: string, uploadId: string, bytes = new Uint8Array([1, 2, 3])) =>
    call(`/missions/${missionId}/files/${fileId}/parts/1`, "PUT", bytes, cookies.editor, {
      "x-upload-id": uploadId,
    });
  const complete = (fileId: string, uploadId: string, parts: unknown[]) =>
    call(`/missions/${missionId}/files/${fileId}/complete`, "POST", { uploadId, parts });

  test("valida formato, tamanho e papel antes de criar arquivo", async () => {
    assert.equal((await prepare(3, "text/html")).status, 415);
    assert.equal((await prepare(2 * 1024 ** 3 + 1)).status, 413);
    assert.equal((await prepare(0)).status, 400);
    assert.equal(
      (
        await call(
          `/missions/${missionId}/uploads`,
          "POST",
          { filename: "x.mp4", contentType: "video/mp4", size: 3 },
          cookies.voice,
        )
      ).status,
      403,
    );
  });
  test("upload interrompido não pode ser lido nem entregue; tamanho incorreto não declara sucesso", async () => {
    const upload = (await (await prepare()).json()) as { fileId: string; uploadId: string };
    const read = `/missions/${missionId}/files/2/${upload.fileId}`;
    assert.equal((await call(read)).status, 404);
    assert.equal(
      (
        await call(`/missions/${missionId}`, "POST", {
          action: "deliver",
          expectedDeliveryVersion: 0,
          link: `https://staging.local/api${read}`,
        })
      ).status,
      400,
    );
    const part = await (
      await sendPart(upload.fileId, upload.uploadId, new Uint8Array([1, 2]))
    ).json();
    assert.equal((await complete(upload.fileId, upload.uploadId, [part])).status, 409);
    assert.equal((await call(read)).status, 404);
  });
  test("persiste conteúdo e autoria, suporta retry e Range e impede acesso alheio", async () => {
    const upload = (await (await prepare()).json()) as { fileId: string; uploadId: string };
    const part = await (await sendPart(upload.fileId, upload.uploadId)).json();
    const done = await complete(upload.fileId, upload.uploadId, [part]);
    assert.equal(done.status, 200);
    assert.equal((await complete(upload.fileId, upload.uploadId, [part])).status, 200);
    const read = `/missions/${missionId}/files/2/${upload.fileId}`;
    assert.equal((await call(read, "GET", undefined, "")).status, 401);
    assert.equal((await call(read, "GET", undefined, cookies.other)).status, 403);
    assert.equal((await call(read, "GET", undefined, cookies.reusedHandle)).status, 403);
    const video = await call(read, "GET", undefined, cookies.voice);
    assert.equal(video.status, 200);
    assert.deepEqual(new Uint8Array(await video.arrayBuffer()), new Uint8Array([1, 2, 3]));
    assert.equal(video.headers.get("cache-control"), "private, no-store");
    const ranged = await call(read, "GET", undefined, cookies.admin, { range: "bytes=1-2" });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get("content-range"), "bytes 1-2/3");
    assert.deepEqual(new Uint8Array(await ranged.arrayBuffer()), new Uint8Array([2, 3]));
    assert.equal(
      (await call(read, "GET", undefined, cookies.admin, { range: "bytes=9-10" })).status,
      416,
    );
    const object = await media.head(`missions/${missionId}/2/${upload.fileId}`);
    assert.equal(object?.customMetadata?.ownerId, "2");
    assert.equal(object?.customMetadata?.filename, "synthetic.mp4");
    assert.equal(
      (
        await call(`/missions/${missionId}`, "POST", {
          action: "deliver",
          expectedDeliveryVersion: 0,
          link: `https://staging.local/api${read}`,
        })
      ).status,
      200,
    );
    const state = await db
      .prepare("SELECT status,delivery_video_url FROM missions WHERE id=?")
      .bind(missionId)
      .first<{ status: string; delivery_video_url: string }>();
    assert.equal(state?.status, "em_revisao");
    assert.equal(state?.delivery_video_url, `https://staging.local/api${read}`);
  });

  test("ajuste e reenvio preservam versões e recusam requisições da versão anterior", async () => {
    const revision = {
      action: "revision",
      notes: "Aumentar a legenda",
      expectedDeliveryVersion: 1,
    };
    assert.equal(
      (await call(`/missions/${missionId}`, "POST", revision, cookies.other)).status,
      403,
    );
    assert.equal(
      (await call(`/missions/${missionId}`, "POST", revision, cookies.voice)).status,
      200,
    );
    assert.equal(
      (await call(`/missions/${missionId}`, "POST", revision, cookies.voice)).status,
      409,
    );
    const upload = (await (await prepare()).json()) as { fileId: string; uploadId: string };
    const part = await (await sendPart(upload.fileId, upload.uploadId)).json();
    const completed = (await (await complete(upload.fileId, upload.uploadId, [part])).json()) as {
      readUrl: string;
    };
    const results = await Promise.all(
      [0, 1].map(() =>
        call(`/missions/${missionId}`, "POST", {
          action: "deliver",
          link: completed.readUrl,
          expectedDeliveryVersion: 1,
        }),
      ),
    );
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
    assert.equal(
      (await call(`/missions/${missionId}`, "POST", revision, cookies.voice)).status,
      409,
    );
    const mission = (await (
      await call(`/missions/view/${missionId}`, "GET", undefined, cookies.voice)
    ).json()) as {
      deliveryVersion: number;
      deliveryHistory: { version: number; deliveryVideoUrl: string }[];
    };
    assert.equal(mission.deliveryVersion, 2);
    assert.deepEqual(
      mission.deliveryHistory.map((version) => version.version),
      [1, 2],
    );
    assert.notEqual(
      mission.deliveryHistory[0].deliveryVideoUrl,
      mission.deliveryHistory[1].deliveryVideoUrl,
    );
    const oldPath = new URL(mission.deliveryHistory[0].deliveryVideoUrl).pathname.replace(
      /^\/api/,
      "",
    );
    assert.equal((await call(oldPath, "GET", undefined, cookies.voice)).status, 200);
    assert.equal(
      await db
        .prepare(
          "SELECT count(*) AS n FROM admin_audit WHERE entity_id=? AND action='entrega_submetida'",
        )
        .bind(String(missionId))
        .first("n"),
      2,
    );
  });
  test("avaliação HTTP exige dono, autenticação, nota válida e conclusão da entrega", async () => {
    const path = `/missions/${missionId}/review`;
    const body = { rating: 4, expectedDeliveryVersion: 2 };
    assert.equal((await call(path, "POST", body, "")).status, 401);
    for (const user of [cookies.editor, cookies.admin, cookies.other, cookies.reusedHandle])
      assert.equal((await call(path, "POST", body, user)).status, 403);
    for (const rating of [0, 6, 2.5, "5", null])
      assert.equal((await call(path, "POST", { ...body, rating }, cookies.voice)).status, 400);
    assert.equal((await call(path, "POST", { ...body, comment: 1 }, cookies.voice)).status, 400);
    assert.equal((await call(path, "POST", body, cookies.voice)).status, 409);
    assert.equal(await db.prepare("SELECT count(*) FROM reviews").first("count(*)"), 0);
  });
  test("aprovação HTTP exige inspeção da versão atual e encerra uma única vez", async () => {
    const approve = { action: "approve", expectedDeliveryVersion: 2, rating: 5 };
    assert.equal(
      (await call(`/missions/${missionId}`, "POST", approve, cookies.voice)).status,
      409,
    );
    assert.equal(
      (await call(`/missions/${missionId}`, "POST", approve, cookies.other)).status,
      403,
    );
    assert.equal(
      (
        await call(
          `/missions/${missionId}`,
          "POST",
          { ...approve, expectedDeliveryVersion: 1 },
          cookies.admin,
        )
      ).status,
      409,
    );
    assert.equal(
      (await call(`/missions/${missionId}`, "POST", approve, cookies.admin)).status,
      200,
    );
    const finish = { action: "accept", expectedDeliveryVersion: 2 };
    const results = await Promise.all([
      call(`/missions/${missionId}`, "POST", finish, cookies.voice),
      call(`/missions/${missionId}`, "POST", finish, cookies.voice),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      await db.prepare("SELECT status FROM missions WHERE id=?").bind(missionId).first("status"),
      "finalizada",
    );
    const assignment = await db
      .prepare("SELECT ended_at,end_reason FROM mission_assignments WHERE mission_id=?")
      .bind(missionId)
      .first<{ ended_at: string | null; end_reason: string }>();
    assert.ok(assignment?.ended_at);
    assert.equal(assignment?.end_reason, "finalizada");
    assert.equal(await db.prepare("SELECT rating FROM users WHERE id=2").first("rating"), null);
    assert.equal(await db.prepare("SELECT count(*) FROM reviews").first("count(*)"), 0);
    assert.equal(
      await db
        .prepare(
          "SELECT count(*) FROM admin_audit WHERE entity_id=? AND action='missao_finalizada'",
        )
        .bind(String(missionId))
        .first("count(*)"),
      1,
    );
  });
  test("avaliação real é idempotente, exclusiva por missão e preserva autor/versão", async () => {
    const path = `/missions/${missionId}/review`;
    const body = { rating: 4, expectedDeliveryVersion: 2, comment: "Entrega sintética aprovada" };
    assert.equal(
      (await call(path, "POST", { ...body, expectedDeliveryVersion: 1 }, cookies.voice)).status,
      409,
    );
    const race = await Promise.all([
      call(path, "POST", body, cookies.voice),
      call(path, "POST", body, cookies.voice),
    ]);
    assert.deepEqual(
      race.map((response) => response.status),
      [200, 200],
    );
    assert.equal((await call(path, "POST", { ...body, rating: 5 }, cookies.voice)).status, 409);
    assert.deepEqual(await (await call(path, "GET", undefined, cookies.voice)).json(), {
      review: { rating: 4, comment: body.comment, version: 2, voidedAt: null },
    });
    const review = await db
      .prepare("SELECT reviewer_id,source,delivery_version FROM reviews WHERE mission_id=?")
      .bind(missionId)
      .first();
    assert.deepEqual(review, { reviewer_id: 1, source: "spokesperson", delivery_version: 2 });
    assert.equal(
      await db
        .prepare("SELECT count(*) FROM admin_audit WHERE action='avaliacao_porta_voz'")
        .first("count(*)"),
      1,
    );
    const profile = (await (await call("/editor/profile/2")).json()) as {
      rating: number;
      ratingCount: number;
    };
    assert.equal(profile.rating, 4);
    assert.equal(profile.ratingCount, 1);
    await assert.rejects(
      () => db.prepare("UPDATE reviews SET rating=5 WHERE mission_id=?").bind(missionId).run(),
      /review_immutable/,
    );
  });
  test("média considera apenas votos reais ativos, e anulação preserva histórico/auditoria", async () => {
    await db
      .prepare("INSERT INTO reviews(mission_id,editor_id,rating) VALUES(?,2,1)")
      .bind(missionId)
      .run();
    const otherMission = await db
      .prepare(
        "INSERT INTO missions(spokesperson_id,title,format,status,reserved_by_id) VALUES(1,'Segunda entrega','short','reservada',2) RETURNING id",
      )
      .first<{ id: number }>();
    const id = otherMission!.id;
    assert.equal(
      (
        await call(`/missions/${id}`, "POST", {
          action: "deliver",
          link: "https://video.example/synthetic",
          expectedDeliveryVersion: 0,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          `/missions/${id}`,
          "POST",
          { action: "approve", rating: 1, expectedDeliveryVersion: 1 },
          cookies.admin,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          `/missions/${id}`,
          "POST",
          { action: "accept", expectedDeliveryVersion: 1 },
          cookies.voice,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          `/missions/${id}/review`,
          "POST",
          { rating: 2, expectedDeliveryVersion: 1 },
          cookies.voice,
        )
      ).status,
      200,
    );
    const profile = (await (await call("/editor/profile/2")).json()) as {
      rating: number;
      ratingCount: number;
    };
    assert.equal(profile.rating, 3);
    assert.equal(profile.ratingCount, 2);
    await assert.rejects(
      () =>
        db
          .prepare(
            "UPDATE reviews SET voided_at='2026-10-13',voided_by=2,void_reason='Sem autorização' WHERE mission_id=? AND source='spokesperson'",
          )
          .bind(id)
          .run(),
      /review_immutable/,
    );
    await db
      .prepare(
        "INSERT INTO ranking_cycles(name,starts_at,ends_at) VALUES('Review test','2026-01-01','2027-01-01')",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO ranking_approvals(mission_id,cycle_id,editor_id,approved_by,approved_at) VALUES(?,(SELECT max(id) FROM ranking_cycles),2,3,'2026-10-13')",
      )
      .bind(id)
      .run();
    const { createD1RankingAdmin } = await import("./ranking-admin.ts");
    const moderation = createD1RankingAdmin(db as unknown as D1DatabaseLike);
    assert.deepEqual(await moderation.cancelApproval(id, 3, "Ensaio de anulação"), { ok: true });
    const after = (await (await call("/editor/profile/2")).json()) as {
      rating: number;
      ratingCount: number;
    };
    assert.equal(after.rating, 4);
    assert.equal(after.ratingCount, 1);
    assert.equal(
      await db.prepare("SELECT count(*) FROM reviews WHERE source='legacy'").first("count(*)"),
      1,
    );
    const historical = await db
      .prepare(
        "SELECT rating,void_reason FROM reviews WHERE mission_id=? AND source='spokesperson'",
      )
      .bind(id)
      .first();
    assert.deepEqual(historical, { rating: 2, void_reason: "Ensaio de anulação" });
    assert.equal(
      await db
        .prepare("SELECT count(*) FROM admin_audit WHERE action='avaliacao_anulada'")
        .first("count(*)"),
      1,
    );
    assert.equal(
      (
        await call(
          `/missions/${id}/review`,
          "POST",
          { rating: 5, expectedDeliveryVersion: 1 },
          cookies.voice,
        )
      ).status,
      409,
    );
  });
  test("notificações persistem por versão, simulam entrega e só mostram os avisos do usuário", async () => {
    const voice = await call(
      `/profile/notifications?missionId=${missionId}`,
      "GET",
      undefined,
      cookies.voice,
    );
    assert.equal(voice.status, 200);
    const events = (await voice.json()) as { event: string; version: number; key: string }[];
    assert.deepEqual(
      events
        .filter((e) => e.event === "submitted")
        .map((e) => e.version)
        .sort(),
      [1, 2],
    );
    const editor = (await (await call(`/profile/notifications?missionId=${missionId}`)).json()) as {
      event: string;
      notes: string | null;
    }[];
    assert.equal(
      editor.some((e) => e.event === "revision" && e.notes === "Aumentar a legenda"),
      true,
    );
    assert.equal(
      editor.some((e) => e.event === "approved"),
      true,
    );
    assert.equal((await call("/profile/notifications", "GET", undefined, "")).status, 401);
    assert.deepEqual(
      await (await call("/profile/notifications", "GET", undefined, cookies.other)).json(),
      [],
    );
    const delivered = await db
      .prepare(
        "SELECT key,delivery_mode,sent_at FROM email_queue WHERE key LIKE 'mission:%:submitted:%' ORDER BY key",
      )
      .all<{ key: string; delivery_mode: string; sent_at: string | null }>();
    assert.equal(delivered.results.length, 3);
    assert.equal(
      delivered.results.every((e) => e.delivery_mode === "simulated" && e.sent_at),
      true,
    );
    assert.equal(
      await db
        .prepare("SELECT count(*) FROM email_queue WHERE delivery_mode='provider'")
        .first("count(*)"),
      0,
    );
  });
  test("cancelamento e repasse preservam a caixa de saída existente sem duplicar eventos", async () => {
    for (const action of ["cancel_mission", "reassign_mission"]) {
      const mission = await db
        .prepare(
          "INSERT INTO missions(spokesperson_id,title,format,status,reserved_by_id,reserved_at) VALUES(1,'Synthetic owner event','short','reservada',2,'2026-01-01T00:00:00.000Z') RETURNING id",
        )
        .first<{ id: number }>();
      const input = db
        .prepare(
          "INSERT INTO mission_owner_events(request_id,mission_id,actor_id,action,reason,expected_version,previous_editor_id,created_at) VALUES(?,?,1,?,'Ensaio sintético',0,2,?) ON CONFLICT(request_id) DO NOTHING",
        )
        .bind(`owner-${action}`, mission!.id, action, new Date().toISOString());
      await input.run();
      await input.run();
      assert.equal(
        await db
          .prepare("SELECT count(*) FROM mission_notifications WHERE mission_id=? AND event=?")
          .bind(mission!.id, action)
          .first("count(*)"),
        1,
      );
      assert.equal(
        await db
          .prepare("SELECT count(*) FROM email_queue WHERE key=?")
          .bind(`mission-owner:owner-${action}`)
          .first("count(*)"),
        1,
      );
      assert.equal(
        await db
          .prepare("SELECT reserved_by_id FROM missions WHERE id=?")
          .bind(mission!.id)
          .first("reserved_by_id"),
        null,
      );
    }
  });
});
