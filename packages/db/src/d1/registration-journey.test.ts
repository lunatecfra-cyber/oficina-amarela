/// <reference lib="dom" />

import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";
import { COOKIE_NAME, createPendingIdentity, createSessionToken } from "@oficina/auth/session";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createApp } from "../../../../apps/api/src/app.ts";
import { runBackgroundTask } from "../../../../apps/api/src/background.ts";
import { d1ApiDependencies } from "../../../../apps/api/src/dependencies.ts";
import { clearSessionRevocationCache } from "../session-revocation.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

describe("jornada de cadastro, perfil e convite com D1 isolado", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-registration-journey-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: Awaited<ReturnType<typeof miniflare.getD1Database>>;
  let app: ReturnType<typeof createApp>;
  let adminCookie: string;
  let queueTasks: unknown[] = [];
  const identity = { googleId: "google-voz", email: "voz@journey.local", name: "Voz Teste" };
  const signup = {
    name: identity.name,
    handle: "voz.journey",
    email: identity.email,
    password: "senha-teste",
    role: "spokesperson",
  };
  const cookieOf = (response: Response) => (response.headers.get("set-cookie") ?? "").split(";")[0];
  const request = (path: string, body?: unknown, cookie = "") =>
    app.request(
      `https://web.local${path}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", cookie },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      },
      {
        DB: db,
        BACKGROUND_QUEUE: {
          async send(message) {
            queueTasks.push(message);
          },
        },
      },
    );
  const invite = async (email = identity.email) => {
    const response = await request("/admin/invitations", { email }, adminCookie);
    assert.equal(response.status, 200);
    return (await response.json()) as { id: number; token: string; link: string };
  };

  before(async () => {
    process.env.AUTH_SECRET = "oficina-registration-isolated-test-secret";
    db = await miniflare.getD1Database("DB");
    await applyAllD1Migrations(db as unknown as D1DatabaseLike);
    app = createApp(d1ApiDependencies(db as unknown as D1DatabaseLike));
  });
  beforeEach(async () => {
    clearSessionRevocationCache();
    queueTasks = [];
    await db.batch([
      db.prepare("DELETE FROM offers"),
      db.prepare("DELETE FROM missions"),
      db.prepare("DELETE FROM email_queue"),
      db.prepare("DELETE FROM editor_verifications"),
      db.prepare("DELETE FROM invitation_redemptions"),
      db.prepare("DELETE FROM spokesperson_invitations"),
      db.prepare("DELETE FROM admin_audit"),
      db.prepare("DELETE FROM gamification_events"),
      db.prepare("DELETE FROM login_attempts"),
      db.prepare("DELETE FROM users"),
    ]);
    const admin = await db
      .prepare(
        "INSERT INTO users (handle, name, email, role) VALUES ('admin.journey', 'Admin', 'admin@journey.local', 'admin') RETURNING id",
      )
      .first<{ id: number }>();
    adminCookie = `${COOKIE_NAME}=${await createSessionToken({
      id: admin!.id,
      handle: "admin.journey",
      name: "Admin",
      role: "admin",
    })}`;
  });
  after(() => miniflare.dispose());

  test("inspetor prioriza a missão pelo contrato usado no panorama", async () => {
    const first = await request("/missions", { title: "Primeira", format: "short" }, adminCookie);
    assert.equal(first.status, 201);
    const second = await request("/missions", { title: "Segunda", format: "short" }, adminCookie);
    const id = ((await second.json()) as { id: number }).id;
    assert.equal((await request("/admin/queue", { id, movement: "top" }, adminCookie)).status, 200);
    const listed = (await (await request("/admin/queue", undefined, adminCookie)).json()) as {
      queue: { id: number }[];
    };
    assert.equal(listed.queue[0].id, id);
    assert.equal(
      (await request("/admin/queue", { id: "invalid", movement: "top" }, adminCookie)).status,
      400,
    );
  });

  test("solicitação → fila → oferta exclusiva → aceite → atribuição persistida", async (t) => {
    t.mock.method(globalThis, "fetch", async () => {
      throw new Error("rede bloqueada no ensaio");
    });
    const issued = await invite();
    const voiceCookie = cookieOf(
      await request("/auth/signup", { ...signup, invitation: issued.token }),
    );
    const editor = await request("/auth/signup", {
      ...signup,
      role: "editor",
      handle: "editor.mission",
      email: "editor@example.invalid",
    });
    const editorId = ((await editor.json()) as { id: number }).id;
    const editorCookie = cookieOf(editor);
    await db.prepare("UPDATE users SET profile_completed = 1 WHERE id = ?").bind(editorId).run();
    assert.equal((await request("/editor/queue/next", undefined, editorCookie)).status, 204);
    const created = await request(
      "/missions",
      {
        title: "Vídeo de teste",
        format: "short",
        spokespersonId: editorId,
        rawMedia: [{ url: "https://example.invalid/bruto.mp4", kind: "video" }],
      },
      voiceCookie,
    );
    assert.equal(created.status, 201);
    const missionId = ((await created.json()) as { id: number }).id;
    assert.deepEqual(queueTasks, [{ type: "mission-queue-sweep" }]);
    await runBackgroundTask(
      {
        missionQueue: d1ApiDependencies(db as unknown as D1DatabaseLike).missionQueue,
        async drainEmailQueue() {
          throw new Error("despacho não deve drenar e-mail");
        },
      },
      queueTasks[0],
    );
    assert.equal((await request(`/missions/${missionId}/interest`, {}, editorCookie)).status, 201);
    assert.equal(
      (
        await request(
          `/missions/${missionId}/selection`,
          { editorId, kind: "interest" },
          voiceCookie,
        )
      ).status,
      201,
    );
    const offered = await request("/editor/queue/next", undefined, editorCookie);
    assert.equal(offered.status, 200);
    assert.equal(
      ((await offered.json()) as { mission: { id: string } }).mission.id,
      `db-${missionId}`,
    );
    assert.equal(
      (
        await request(
          "/editor/queue/next",
          {
            action: "accept",
            missionId,
          },
          adminCookie,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request(
          "/editor/queue/next",
          {
            action: "accept",
            missionId,
          },
          editorCookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "/editor/queue/next",
          {
            action: "accept",
            missionId,
          },
          editorCookie,
        )
      ).status,
      200,
    );
    const active = await request("/editor/active-mission", undefined, editorCookie);
    assert.equal(((await active.json()) as { id: string }).id, `db-${missionId}`);
    assert.equal(
      (await request(`/missions/view/${missionId}`, undefined, editorCookie)).status,
      200,
    );
    assert.equal(
      (await request(`/missions/view/${missionId}`, undefined, voiceCookie)).status,
      200,
    );
    const assignment = await db
      .prepare(
        "SELECT editor_id FROM mission_assignments WHERE mission_id = ? AND ended_at IS NULL",
      )
      .bind(missionId)
      .first<{ editor_id: number }>();
    assert.equal(assignment?.editor_id, editorId);
    const owner = await db
      .prepare("SELECT spokesperson_id FROM missions WHERE id = ?")
      .bind(missionId)
      .first<{ spokesperson_id: number }>();
    assert.notEqual(owner?.spokesperson_id, editorId);
    assert.equal(
      await db
        .prepare("SELECT count(*) AS n FROM email_queue WHERE sent_at IS NOT NULL")
        .first("n"),
      0,
    );
  });

  test("editor não apaga missão de outro usuário", async () => {
    const editorCookie = cookieOf(await request("/auth/signup", { ...signup, role: "editor" }));
    const created = await request(
      "/missions",
      { title: "Missão protegida", format: "short" },
      adminCookie,
    );
    const missionId = ((await created.json()) as { id: number }).id;
    const removed = await app.request(
      `/missions/${missionId}`,
      {
        method: "DELETE",
        headers: { cookie: editorCookie },
      },
      { DB: db },
    );
    assert.equal(removed.status, 403);
    assert.ok(await db.prepare("SELECT id FROM missions WHERE id = ?").bind(missionId).first());
    const adminRemoved = await app.request(
      `/missions/${missionId}`,
      {
        method: "DELETE",
        headers: { cookie: adminCookie },
      },
      { DB: db },
    );
    assert.equal(adminRemoved.status, 200);
  });

  test("detalhes da missão ficam restritos aos participantes e ao inspetor", async () => {
    const editorCookie = cookieOf(await request("/auth/signup", { ...signup, role: "editor" }));
    const created = await request(
      "/missions",
      { title: "Missão privada", format: "short", voterId: "123456789012" },
      adminCookie,
    );
    const missionId = ((await created.json()) as { id: number }).id;
    assert.equal(
      (await request(`/missions/view/${missionId}`, undefined, editorCookie)).status,
      403,
    );
    assert.equal(
      (await request(`/missions/view/${missionId}`, undefined, adminCookie)).status,
      200,
    );
  });

  test("admin emite → cadastro resgata uma vez → perfil → acesso → admin confere", async () => {
    const issued = await invite();
    assert.equal(issued.link, `https://web.local/criar-conta?convite=${issued.token}`);
    const response = await request("/auth/signup", { ...signup, invitation: issued.token });
    assert.equal(response.status, 200);
    const account = (await response.json()) as { id: number; role: string };
    assert.equal(account.role, "spokesperson");
    const cookie = cookieOf(response);
    assert.match(cookie, new RegExp(`^${COOKIE_NAME}=`));
    assert.equal((await request("/auth/session", undefined, cookie)).status, 200);
    assert.equal((await request("/editor/profile", undefined, cookie)).status, 403);
    assert.equal((await request("/admin/users", undefined, cookie)).status, 403);
    assert.equal((await request("/spokesperson/profile", { name: "Voz" }, cookie)).status, 400);
    assert.equal(
      (
        await request(
          "/spokesperson/profile",
          {
            name: "Voz Oficial",
            politicalOffice: "Vereador",
            location: "Curitiba, PR",
            candidateNumber: "5510",
            campaignTaxId: "12.345.678/0001-90",
          },
          cookie,
        )
      ).status,
      200,
    );
    const checked = await request(`/admin/users/${account.id}`, undefined, adminCookie);
    assert.equal(checked.status, 200);
    const details = (await checked.json()) as { profileCompleted: boolean; createdAt: string };
    assert.equal(details.profileCompleted, true);
    assert.ok(Number.isFinite(Date.parse(details.createdAt)));
    const repeated = await request("/auth/signup", { ...signup, invitation: issued.token });
    assert.equal(repeated.status, 400);
    assert.match(((await repeated.json()) as { error: string }).error, /já foi usado/);
    assert.equal(
      await db.prepare("SELECT count(*) AS n FROM users WHERE role = 'voz'").first("n"),
      1,
    );
  });

  test("convites inválidos, expirados, revogados e de outro e-mail não criam conta", async () => {
    assert.equal(
      (await request("/auth/signup", { ...signup, invitation: "invalido" })).status,
      400,
    );
    const issued = await invite();
    const wrongEmail = await request("/auth/signup", {
      ...signup,
      email: "outra@journey.local",
      invitation: issued.token,
    });
    assert.match(((await wrongEmail.json()) as { error: string }).error, /outro e-mail/);
    await db
      .prepare(
        "UPDATE spokesperson_invitations SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
      )
      .bind(issued.id)
      .run();
    const expired = await request("/auth/signup", { ...signup, invitation: issued.token });
    assert.match(((await expired.json()) as { error: string }).error, /expirou/);
    const replacement = await invite();
    assert.equal(
      (await request("/admin/invitations", { action: "revoke", id: replacement.id }, adminCookie))
        .status,
      200,
    );
    const revoked = await request("/auth/signup", { ...signup, invitation: replacement.token });
    assert.match(((await revoked.json()) as { error: string }).error, /revogado/);
    assert.equal(
      await db.prepare("SELECT count(*) AS n FROM users WHERE role = 'voz'").first("n"),
      0,
    );
  });

  test("conflito de apelido preserva convite para nova tentativa", async () => {
    const issued = await invite();
    const conflict = await request("/auth/signup", {
      ...signup,
      handle: "admin.journey",
      invitation: issued.token,
    });
    assert.equal(conflict.status, 409);
    const retry = await request("/auth/signup", { ...signup, invitation: issued.token });
    assert.equal(retry.status, 200);
  });

  test("Google recusa identidade sem prova, assinatura alterada e token expirado", async (t) => {
    const token = await createPendingIdentity(identity);
    for (const path of ["/auth/google/find", "/auth/google/register"]) {
      for (const identityToken of [undefined, 123, `${token.slice(0, -3)}xxx`]) {
        const response = await request(path, { ...identity, role: "editor", identityToken });
        assert.equal(response.status, 401);
        assert.equal(response.headers.get("set-cookie"), null);
      }
    }
    t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 11 * 60_000 });
    for (const path of ["/auth/google/find", "/auth/google/register"]) {
      assert.equal((await request(path, { identityToken: token, role: "editor" })).status, 401);
    }
    t.mock.timers.reset();
    assert.equal(await db.prepare("SELECT count(*) AS n FROM users").first("n"), 1);
  });

  test("Google usa apenas a identidade assinada e mantém convite e papéis", async () => {
    const identityToken = await createPendingIdentity(identity);
    assert.equal((await request("/auth/google/find", { identityToken })).status, 200);
    assert.equal(
      (await request("/auth/google/register", { identityToken, role: "admin" })).status,
      400,
    );
    assert.equal(
      (await request("/auth/google/register", { identityToken, role: "spokesperson" })).status,
      400,
    );
    const issued = await invite();
    const response = await request("/auth/google/register", {
      identityToken,
      role: "spokesperson",
      invitation: issued.token,
      email: "forged@journey.local",
      googleId: "forged",
      name: "Falso",
    });
    assert.equal(response.status, 200);
    const account = (await response.json()) as { email: string; name: string };
    assert.equal(account.email, identity.email);
    assert.equal(account.name, identity.name);
    const found = await request("/auth/google/find", { identityToken });
    assert.equal(found.status, 200);
    await db.prepare("UPDATE users SET is_banned = 1 WHERE email = ?").bind(identity.email).run();
    assert.equal((await request("/auth/google/find", { identityToken })).status, 403);
  });

  test("Google vincula conta por e-mail somente com identidade assinada", async () => {
    await db
      .prepare(
        "INSERT INTO users (handle, name, email, role) VALUES ('editor.journey', 'Editor', ?, 'editor')",
      )
      .bind(identity.email)
      .run();
    const forged = await request("/auth/google/find", identity);
    assert.equal(forged.status, 401);
    assert.equal(
      await db
        .prepare("SELECT google_id FROM users WHERE email = ?")
        .bind(identity.email)
        .first("google_id"),
      null,
    );
    const linked = await request("/auth/google/find", {
      identityToken: await createPendingIdentity(identity),
    });
    assert.equal(linked.status, 200);
    assert.equal(
      await db
        .prepare("SELECT google_id FROM users WHERE email = ?")
        .bind(identity.email)
        .first("google_id"),
      identity.googleId,
    );
  });

  test("editor se cadastra, completa perfil e não administra convites", async () => {
    assert.equal((await request("/admin/invitations", { email: identity.email })).status, 401);
    const response = await request("/auth/signup", { ...signup, role: "editor" });
    assert.equal(response.status, 200);
    const cookie = cookieOf(response);
    assert.equal(
      (await request("/admin/invitations", { email: identity.email }, cookie)).status,
      403,
    );
    assert.equal((await request("/spokesperson/profile", undefined, cookie)).status, 403);
    assert.equal(
      (
        await request(
          "/editor/profile",
          {
            name: "Editor Teste",
            location: "Curitiba, PR",
            softwares: ["Premiere"],
            styles: ["Reels"],
            editingLevel: "Avançado",
            pcSetup: "PC",
          },
          cookie,
        )
      ).status,
      200,
    );
    const login = await request("/auth/login", {
      handle: identity.email,
      password: signup.password,
    });
    assert.equal(login.status, 200);
    assert.equal((await request("/auth/signup", { ...signup, role: "editor" })).status, 409);
  });

  test("cliente não manipula bloqueios de login e cadastro", async () => {
    const forged = { key: "login:admin.journey", max: 0, windowMinutes: -1, lockMinutes: 99999 };
    for (const path of ["/auth/rate-limit/check", "/auth/rate-limit/record"]) {
      assert.equal((await request(path, forged)).status, 401);
    }
    const response = await request("/auth/signup", { ...signup, role: "editor" });
    const cookie = cookieOf(response);
    assert.equal((await request("/auth/rate-limit/record", forged, cookie)).status, 200);
    assert.equal(
      await db
        .prepare("SELECT count(*) AS n FROM login_attempts WHERE key = ?")
        .bind(forged.key)
        .first("n"),
      0,
    );
    assert.equal((await request("/auth/rate-limit/check", forged, cookie)).status, 200);
    for (let i = 1; i < 20; i++) {
      assert.equal((await request("/auth/rate-limit/record", forged, cookie)).status, 200);
    }
    const checked = await request("/auth/rate-limit/check", {}, cookie);
    assert.equal(((await checked.json()) as { locked: boolean }).locked, true);
  });
  test("experienced invitation is admin-only, single-use, typed and preserves provenance without stars", async () => {
    const email = "experienced@journey.local";
    const issued = await request(
      "/admin/invitations",
      { email, kind: "experienced_editor", specialties: ["Documentário"] },
      adminCookie,
    );
    assert.equal(issued.status, 200);
    const invitation = (await issued.json()) as { token: string; id: number; link: string };
    assert.ok(invitation.link.includes("kind=experienced_editor"));
    assert.equal(
      (
        await request("/auth/signup", {
          ...signup,
          email,
          handle: "experienced",
          invitation: invitation.token,
        })
      ).status,
      400,
    );
    const results = await Promise.all(
      ["experienced", "experienced2"].map((handle) =>
        request("/auth/signup", {
          ...signup,
          email,
          handle,
          role: "editor",
          invitation: invitation.token,
        }),
      ),
    );
    assert.equal(results.filter((result) => result.status === 200).length, 1);
    const account = await db
      .prepare("SELECT id,role,rating,reputation,delivered_count FROM users WHERE email=?")
      .bind(email)
      .first<{
        id: number;
        role: string;
        rating: null;
        reputation: number;
        delivered_count: number;
      }>();
    assert.equal(account!.role, "editor");
    assert.equal(account!.rating, null);

    assert.equal(account!.delivered_count, 0);
    const provenance = await db
      .prepare("SELECT verified,invitation_id FROM editor_verifications WHERE editor_id=?")
      .bind(account!.id)
      .first();
    assert.deepEqual(provenance, { verified: 1, invitation_id: invitation.id });
    const successful = results.find((result) => result.status === 200)!;
    const profile = (await (
      await request("/editor/profile", undefined, cookieOf(successful))
    ).json()) as {
      experiencedInvitedByAdmin: boolean;
      administrativelyVerified: boolean;
      paidWorkQualified: boolean;
    };
    assert.equal(profile.experiencedInvitedByAdmin, true);
    assert.equal(profile.administrativelyVerified, true);
    assert.equal(profile.paidWorkQualified, true);
    const manager = await db
      .prepare(
        "INSERT INTO users(handle,name,email,role) VALUES('qualification.admin','Manager','manager@journey.local','admin') RETURNING id",
      )
      .first<{ id: number }>();
    const managerCookie = `${COOKIE_NAME}=${await createSessionToken({ id: manager!.id, handle: "qualification.admin", name: "Manager", role: "admin" })}`;
    assert.equal(
      (
        await request(
          `/admin/users/${account!.id}`,
          { verified: false, reason: "Revogação sintética antes de completar perfil" },
          managerCookie,
        )
      ).status,
      200,
    );
    const revokedProfile = (await (
      await request("/editor/profile", undefined, cookieOf(successful))
    ).json()) as { experiencedInvitedByAdmin: boolean; paidWorkQualified: boolean };
    assert.equal(revokedProfile.experiencedInvitedByAdmin, true);
    assert.equal(revokedProfile.paidWorkQualified, false);
    assert.equal(
      (
        await request(
          `/admin/users/${account!.id}`,
          { verified: true, reason: "Habilitação sintética restabelecida" },
          adminCookie,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(
          "/admin/invitations",
          { email: "other@journey.local", kind: "experienced_editor" },
          cookieOf(successful),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/auth/signup", {
          ...signup,
          email,
          handle: "reused",
          role: "editor",
          invitation: invitation.token,
        })
      ).status,
      400,
    );
  });
  test("experienced invitations reject revoked, expired, wrong-email and public privileged signup", async () => {
    for (const state of ["revoked", "expired", "wrong-email"]) {
      const email = `${state}@journey.local`;
      const issued = await request(
        "/admin/invitations",
        { email, kind: "experienced_editor" },
        adminCookie,
      );
      const invitation = (await issued.json()) as { id: number; token: string };
      if (state === "revoked")
        assert.equal(
          (
            await request(
              "/admin/invitations",
              { action: "revoke", id: invitation.id },
              adminCookie,
            )
          ).status,
          200,
        );
      if (state === "expired")
        await db
          .prepare("UPDATE spokesperson_invitations SET expires_at='2000-01-01' WHERE id=?")
          .bind(invitation.id)
          .run();
      assert.equal(
        (
          await request("/auth/signup", {
            ...signup,
            handle: state,
            email: state === "wrong-email" ? "different@journey.local" : email,
            role: "editor",
            invitation: invitation.token,
          })
        ).status,
        400,
      );
    }
    for (const role of ["admin", "inspector"])
      assert.equal((await request("/auth/signup", { ...signup, role })).status, 400);
  });
});
