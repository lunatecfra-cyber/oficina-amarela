// Ensaio sintético completo; destinos fixos impedem execução em produção.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile),
  require = createRequire(new URL("../apps/api/package.json", import.meta.url));
const API = "https://oficina-amarela-api-staging.casamarela.workers.dev";
const WEB = "https://oficina-amarela-web-staging.casamarela.workers.dev";
assert.ok(process.argv[2], "Informe o caminho do resultado JSON antes de executar.");
const stamp = Date.now(),
  password = "senha-de-concorrencia-123",
  hash = await require("bcryptjs").hash(password, 10);
const evidence = {
  createdAt: new Date().toISOString(),
  api: API,
  web: WEB,
  checks: [],
  users: {},
  missions: [],
};
const cookies = {};
async function sql(command) {
  const { stdout } = await run(
    "bunx",
    [
      "wrangler",
      "d1",
      "execute",
      "oficina-amarela-staging",
      "--remote",
      "--env",
      "staging",
      "--config",
      "apps/api/wrangler.jsonc",
      "--json",
      "--command",
      command,
    ],
    { maxBuffer: 8 * 1024 ** 2 },
  );
  return JSON.parse(stdout.slice(stdout.indexOf("[")))[0].results;
}
async function call(path, actor, method = "GET", body, headers = {}, web = false) {
  return fetch(`${web ? `${WEB}/api` : API}${path}`, {
    method,
    headers: {
      ...(cookies[actor] ? { cookie: cookies[actor] } : {}),
      ...(body && !ArrayBuffer.isView(body) ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: ArrayBuffer.isView(body) ? body : JSON.stringify(body) }),
  });
}
async function check(name, response, expected = 200) {
  const text = await response.text();
  assert.equal(response.status, expected, `${name}: ${response.status} ${text.slice(0, 500)}`);
  evidence.checks.push({ name, status: response.status });
  console.log(`OK ${name} (${response.status})`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
async function login(actor) {
  const response = await call("/auth/login", null, "POST", {
    handle: evidence.users[actor].handle,
    password,
  });
  assert.equal(response.status, 200);
  cookies[actor] = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookies[actor]);
}
const temp = await mkdtemp(join(tmpdir(), "oficina-moderacao-"));
try {
  for (const actor of ["inspector", "moderator", "release"]) {
    const handle = `md.${actor.slice(0, 3)}.${stamp}`;
    const [row] = await sql(
      `INSERT INTO users(handle,name,email,role,password_hash,profile_completed) VALUES('${handle}','Synthetic ${actor}','${handle}@example.invalid','admin','${hash}',1) RETURNING id`,
    );
    evidence.users[actor] = { id: row.id, handle };
    await login(actor);
  }
  await sql(
    `INSERT INTO admin_capabilities VALUES(${evidence.users.release.id},'release_report_retention')`,
  );
  const email = `mod.voice.${stamp}@example.invalid`;
  const invitation = await check(
    "convite oficial",
    await call("/admin/invitations", "moderator", "POST", { email }),
  );
  for (const [actor, role] of [
    ["voice", "spokesperson"],
    ["editor", "editor"],
    ["outsider", "editor"],
  ]) {
    const handle = `md.${actor.slice(0, 3)}.${stamp}`;
    const response = await call("/auth/signup", null, "POST", {
      name: `Synthetic ${actor}`,
      handle,
      email: actor === "voice" ? email : `${handle}@example.invalid`,
      password,
      role,
      ...(actor === "voice" ? { invitation: invitation.token } : {}),
    });
    cookies[actor] = response.headers.get("set-cookie")?.split(";")[0];
    const signup = await check(`cadastro ${actor}`, response);
    evidence.users[actor] = { id: signup.id, handle };
    assert.ok(cookies[actor]);
  }
  await sql(
    `UPDATE users SET profile_completed=1,directory_visible=1,work_preference='volunteer',last_seen_at='2099-01-01T00:00:00.000Z' WHERE id=${evidence.users.editor.id}`,
  );
  const created = await check(
    "criação pelo porta-voz",
    await call("/missions", "voice", "POST", {
      title: `Ensaio moderação ${stamp}`,
      format: "short",
      manualSelection: true,
    }),
    201,
  );
  const missionId = created.id;
  evidence.missions.push(missionId);
  await check(
    "convite ao editor",
    await call(`/missions/${missionId}/selection`, "voice", "POST", {
      editorId: evidence.users.editor.id,
      kind: "direct",
    }),
    201,
  );
  const accepts = await Promise.all([
    call("/editor/queue/next", "editor", "POST", { missionId, action: "accept" }),
    call("/editor/queue/next", "editor", "POST", { missionId, action: "accept" }),
    call("/editor/queue/next", "outsider", "POST", { missionId, action: "accept" }),
  ]);
  const accepted = accepts.map((r) => r.status).sort();
  assert.deepEqual(accepted, [200, 200, 409]);
  const assignments = await sql(
    `SELECT editor_id FROM mission_assignments WHERE mission_id=${missionId} AND ended_at IS NULL`,
  );
  assert.deepEqual(assignments, [{ editor_id: evidence.users.editor.id }]);
  evidence.checks.push({ name: "atribuição concorrente exclusiva", statuses: accepted });
  await check(
    "chat privado",
    await call(`/missions/${missionId}`, "editor", "POST", {
      action: "message",
      text: "Mensagem sintética preservada",
    }),
  );
  const messages = await check("porta-voz lê chat", await call(`/missions/${missionId}`, "voice"));
  assert.ok(messages.messages.some((m) => m.text === "Mensagem sintética preservada"));
  await check("intruso não lê chat", await call(`/missions/${missionId}`, "outsider"), 403);
  const video = join(temp, "sintetico.mp4");
  await run("ffmpeg", [
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=yellow:s=160x90:d=1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-y",
    video,
  ]);
  const bytes = await readFile(video);
  async function deliver(version) {
    const upload = await check(
      `preparar upload v${version + 1}`,
      await call(`/missions/${missionId}/uploads`, "editor", "POST", {
        filename: "sintetico.mp4",
        contentType: "video/mp4",
        size: bytes.length,
      }),
    );
    const base = `/missions/${missionId}/files/${upload.fileId}`;
    const part = await check(
      `upload v${version + 1}`,
      await call(`${base}/parts/1`, "editor", "PUT", bytes, { "x-upload-id": upload.uploadId }),
    );
    const completed = await check(
      `conclusão upload v${version + 1}`,
      await call(`${base}/complete`, "editor", "POST", {
        uploadId: upload.uploadId,
        parts: [part],
      }),
    );
    await check(
      `entrega v${version + 1}`,
      await call(`/missions/${missionId}`, "editor", "POST", {
        action: "deliver",
        videoUrl: new URL(new URL(completed.readUrl).pathname, WEB).href,
        expectedDeliveryVersion: version,
      }),
    );
    return new URL(new URL(completed.readUrl).pathname, WEB).href;
  }
  const v1 = await deliver(0);
  await check(
    "reedição com justificativa",
    await call(`/missions/${missionId}`, "voice", "POST", {
      action: "revision",
      notes: "Ajustar o título da versão sintética",
      expectedDeliveryVersion: 1,
    }),
  );
  const v2 = await deliver(1);
  await check(
    "versão antiga não aprova nova",
    await call(`/missions/${missionId}`, "inspector", "POST", {
      action: "approve",
      expectedDeliveryVersion: 1,
    }),
    409,
  );
  await check(
    "intruso não inspeciona",
    await call(`/missions/${missionId}`, "outsider", "POST", {
      action: "approve",
      expectedDeliveryVersion: 2,
    }),
    403,
  );
  await check(
    "inspeção independente",
    await call(`/missions/${missionId}`, "inspector", "POST", {
      action: "approve",
      expectedDeliveryVersion: 2,
    }),
  );
  await check(
    "aceite pelo proprietário",
    await call(`/missions/${missionId}`, "voice", "POST", {
      action: "accept",
      expectedDeliveryVersion: 2,
    }),
  );
  await check(
    "avaliação verificada",
    await call(`/missions/${missionId}/review`, "voice", "POST", {
      rating: 4,
      comment: "Ensaio sintético aprovado",
      expectedDeliveryVersion: 2,
    }),
  );
  await check(
    "denúncia distinta da revisão",
    await call(`/missions/${missionId}`, "voice", "POST", {
      action: "report",
      text: "Ensaio de preservação e decisão fundamentada",
    }),
  );
  const [report] = await sql(`SELECT id FROM reports WHERE mission_id=${missionId}`);
  evidence.reportId = report.id;
  const base = `/admin/reports/${report.id}`;
  const capture = await check(
    "evidência pelo proxy web",
    await call(`${base}/evidence`, "moderator", "GET", undefined, {}, true),
  );
  assert.equal(capture.evidence.filter((e) => e.kind === "delivery").length, 2);
  assert.equal(capture.evidence.filter((e) => e.kind === "inspection").length, 1);
  await check("intruso não consulta evidência", await call(`${base}/evidence`, "outsider"), 403);
  await check(
    "decisão exige justificativa",
    await call(`${base}/resolve`, "moderator", "POST", { status: "resolved" }),
    400,
  );
  await check(
    "fiscal impedido de julgar sua inspeção",
    await call(`${base}/resolve`, "inspector", "POST", {
      status: "resolved",
      reason: "Não arbitrar a própria inspeção",
    }),
    409,
  );
  const decisions = await Promise.all([
    call(`${base}/resolve`, "moderator", "POST", {
      status: "resolved",
      reason: "Entrega e histórico conferidos no ensaio",
    }),
    call(`${base}/resolve`, "release", "POST", {
      status: "ignored",
      reason: "Outra interpretação concorrente",
    }),
  ]);
  assert.deepEqual(decisions.map((r) => r.status).sort(), [200, 409]);
  evidence.checks.push({
    name: "decisão concorrente única",
    statuses: decisions.map((r) => r.status),
  });
  const [decision] = await sql(`SELECT * FROM report_decisions WHERE report_id=${report.id}`);
  const winner = decision.actor_id === evidence.users.moderator.id ? "moderator" : "release";
  await check(
    "retry da decisão é idempotente",
    await call(`${base}/resolve`, winner, "POST", {
      status: decision.status,
      reason: decision.reason,
    }),
  );
  await check(
    "decisão mantém exclusão bloqueada",
    await call(`/missions/${missionId}`, "moderator", "DELETE"),
    400,
  );
  await check(
    "conta retida não é apagada",
    await call("/account", "editor", "DELETE", { confirmation: evidence.users.editor.handle }),
    409,
  );
  await check(
    "inspetor não libera retenção",
    await call(`${base}/release-retention`, "moderator", "POST", {
      reason: "Motivo não concede capacidade",
    }),
    403,
  );
  const before = await sql(
    `SELECT id,status,reserved_by_id,delivery_version FROM missions WHERE id=${missionId}`,
  );
  evidence.database = {
    mission: before,
    decisions: await sql(`SELECT * FROM report_decisions WHERE report_id=${report.id}`),
    captures: await sql(`SELECT * FROM report_evidence_captures WHERE report_id=${report.id}`),
    foreignKeys: await sql("PRAGMA foreign_key_check"),
  };
  assert.equal(before[0].status, "finalizada");
  assert.equal(before[0].delivery_version, 2);
  assert.deepEqual(evidence.database.foreignKeys, []);
  const releases = await Promise.all([
    call(`${base}/release-retention`, "release", "POST", {
      reason: "Ensaio encerrado; retenção revisada sem exclusão",
    }),
    call(`${base}/release-retention`, "release", "POST", {
      reason: "Ensaio encerrado; retenção revisada sem exclusão",
    }),
  ]);
  assert.deepEqual(
    releases.map((r) => r.status),
    [200, 200],
  );
  await sql(`DELETE FROM admin_capabilities WHERE user_id=${evidence.users.release.id}`);
  await check(
    "capacidade revogada vale imediatamente",
    await call(`${base}/release-retention`, "release", "POST", {
      reason: "Ensaio encerrado; retenção revisada sem exclusão",
    }),
    403,
  );
  evidence.database.releases = await sql(
    `SELECT * FROM report_retention_releases WHERE report_id=${report.id}`,
  );
  evidence.database.audit = await sql(
    `SELECT action,actor_id,details FROM admin_audit WHERE entity='report' AND entity_id='${report.id}'`,
  );
  assert.equal(evidence.database.audit.filter((a) => a.action === "denuncia_decidida").length, 1);
  assert.equal(
    evidence.database.audit.filter((a) => a.action === "retencao_denuncia_liberada").length,
    1,
  );
  evidence.videoUrls = [v1, v2];
  await writeFile(process.argv[2], JSON.stringify(evidence, null, 2));
  console.log(
    `Ensaio aprovado: missão ${missionId}, denúncia ${report.id}; registros sintéticos preservados.`,
  );
} finally {
  const createdUsers = await sql(
    `SELECT id FROM users WHERE handle IN ('md.ins.${stamp}','md.mod.${stamp}','md.rel.${stamp}','md.voi.${stamp}','md.edi.${stamp}','md.out.${stamp}')`,
  );
  if (evidence.users.release)
    await sql(`DELETE FROM admin_capabilities WHERE user_id=${evidence.users.release.id}`);
  const ids = createdUsers.map((user) => user.id);
  if (ids.length) {
    assert.ok(ids.every(Number.isSafeInteger));
    await sql(
      `UPDATE users SET is_banned=1,ban_reason='Ensaio sintético encerrado',sessions_valid_after=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id IN (${ids.join(",")})`,
    );
  }
  await rm(temp, { recursive: true, force: true });
}
