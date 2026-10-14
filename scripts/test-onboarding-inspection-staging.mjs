import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import bcrypt from "../apps/web/node_modules/bcryptjs/index.js";

const WEB = "https://oficina-amarela-web-staging.casamarela.workers.dev";
const DB = "oficina-amarela-staging";
const stamp = Date.now(),
  password = randomUUID(),
  prefix = `onb.${stamp}`;
const accounts = {},
  missions = [],
  checks = [];
const run = promisify(execFile);
const d1 = async (sql) => {
  const { stdout } = await run(
    "bunx",
    [
      "wrangler",
      "d1",
      "execute",
      DB,
      "--remote",
      "--config",
      "apps/api/wrangler.jsonc",
      "--env",
      "staging",
      "--json",
      "--command",
      sql,
    ],
    {
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: "53878b12fbc280f03fc30b5875f3522f" },
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout)[0].results;
};
async function call(path, actor, body, expected = 200) {
  const response = await fetch(`${WEB}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(accounts[actor]?.cookie ? { cookie: accounts[actor].cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => null);
  assert.equal(response.status, expected, `${path}: ${JSON.stringify(data)}`);
  return { data, response };
}
async function login(actor) {
  const { response, data } = await call("/auth/login", null, {
    handle: accounts[actor].handle,
    password,
  });
  accounts[actor].cookie = response.headers.get("set-cookie").split(";")[0];
  assert.equal(data.role, accounts[actor].role);
}
async function signup(actor, role, invitation) {
  const handle = `${actor === "experienced" ? "exp" : actor}.${stamp}`,
    email = `${handle}@example.invalid`;
  const { data, response } = await call("/auth/signup", null, {
    name: `Ensaio ${actor}`,
    handle,
    email,
    password,
    role,
    invitation,
  });
  accounts[actor] = {
    id: data.id,
    handle,
    email,
    role,
    cookie: response.headers.get("set-cookie").split(";")[0],
  };
}
const ok = (name) => {
  checks.push(name);
  console.log(`ok: ${name}`);
};
assert.equal(new URL(WEB).hostname, "oficina-amarela-web-staging.casamarela.workers.dev");
assert.ok(DB.endsWith("-staging"));
if (process.argv.includes("--self-check")) {
  console.log("staging guard: passed");
  process.exit(0);
}
assert.ok(process.argv.includes("--run"), "Use --run only for an authorized staging journey");
const video = await readFile(process.env.SYNTHETIC_VIDEO ?? "/tmp/oficina-portfolio-synthetic.mp4");
const hash = await bcrypt.hash(password, 10);
for (const [actor, role] of [
  ["admin", "admin"],
  ["inspector", "inspector"],
  ["other", "inspector"],
]) {
  const handle = `${actor}.${stamp}`;
  const [row] = await d1(
    `INSERT INTO users(handle,name,email,role,password_hash) VALUES('${handle}','Ensaio ${actor}','${handle}@example.invalid','${role}','${hash}') RETURNING id`,
  );
  accounts[actor] = { id: row.id, handle, role };
  await login(actor);
}
await signup("beginner", "editor");
const voiceEmail = `voice.${stamp}@example.invalid`;
const voiceInvitation = (await call("/admin/invitations", "admin", { email: voiceEmail })).data;
await signup("voice", "spokesperson", voiceInvitation.token);
const experiencedEmail = `exp.${stamp}@example.invalid`;
const invitation = (
  await call("/admin/invitations", "admin", {
    email: experiencedEmail,
    kind: "experienced_editor",
    specialties: ["Documentário"],
  })
).data;
await signup("experienced", "editor", invitation.token);
await call(
  "/auth/signup",
  null,
  {
    name: "Replay",
    handle: `replay.${stamp}`,
    email: experiencedEmail,
    password,
    role: "editor",
    invitation: invitation.token,
  },
  400,
);
await writeFile(
  `/tmp/oficina-onboarding-${stamp}-accounts.json`,
  JSON.stringify({ password, accounts, missions }, null, 2),
  { mode: 0o600 },
);
ok("convite administrativo de uso único resgatado sem elevar papel");
for (const actor of ["beginner", "experienced"]) {
  await call("/editor/profile", actor, {
    name: `Ensaio ${actor}`,
    editingStyles: ["documentary"],
    availability: Array.from({ length: 3 }, () => Array(7).fill(true)),
  });
  await call("/editors/visibility", actor, {
    visible: true,
    portfolioConsent: false,
    workPreference: actor === "beginner" ? "volunteer" : "both",
  });
}
assert.equal((await call("/editor/profile", "experienced")).data.experiencedInvitedByAdmin, true);
assert.equal((await call("/editor/profile", "experienced")).data.administrativelyVerified, true);
await login("beginner");
assert.equal((await call("/editors/visibility", "beginner")).data.workPreference, "volunteer");
ok("perfil, disponibilidade, selo e preferência persistem após novo login");
async function createMission(actor) {
  const { data } = await call(
    "/missions",
    "voice",
    {
      title: `Ensaio onboarding ${actor} ${stamp}`,
      format: "short",
      motivation: "Conteúdo sintético para inspeção",
    },
    201,
  );
  const id = data.id;
  missions.push(id);
  await call(
    `/missions/${id}/selection`,
    "voice",
    { editorId: accounts[actor].id, kind: "direct" },
    201,
  );
  await call("/editor/queue/next", actor, { missionId: id, action: "accept" });
  return id;
}
async function deliver(id, actor, version) {
  const upload = (
    await call(`/missions/${id}/uploads`, actor, {
      filename: "ensaio.mp4",
      contentType: "video/mp4",
      size: video.length,
    })
  ).data;
  const part = await fetch(`${WEB}/api/missions/${id}/files/${upload.fileId}/parts/1`, {
    method: "PUT",
    headers: { cookie: accounts[actor].cookie, "x-upload-id": upload.uploadId },
    body: video,
  });
  assert.equal(part.status, 200);
  const link = (
    await call(`/missions/${id}/files/${upload.fileId}/complete`, actor, {
      uploadId: upload.uploadId,
      parts: [await part.json()],
    })
  ).data.readUrl;
  await call(`/missions/${id}`, actor, {
    action: "deliver",
    link,
    expectedDeliveryVersion: version,
  });
  return link;
}
const beginning = await createMission("beginner");
await deliver(beginning, "beginner", 0);
const experienced = await createMission("experienced");
await deliver(experienced, "experienced", 0);
const reasons = await d1(
  `SELECT id,inspection_reason,inspection_required FROM missions WHERE id IN (${beginning},${experienced}) ORDER BY id`,
);
assert.ok(reasons.some((row) => row.inspection_reason === "first_three_deliveries"));
assert.ok(reasons.some((row) => row.inspection_reason === "invited_first_delivery"));
assert.ok(reasons.every((row) => row.inspection_required === 1));
ok("primeira entrega de iniciante e experiente exige inspeção correta");
await call(
  `/missions/${beginning}`,
  "voice",
  { action: "approve", expectedDeliveryVersion: 1 },
  409,
);
const queue = (await call("/inspections", "inspector")).data;
assert.ok(queue.some((item) => item.id === beginning));
await call(`/inspections/${beginning}/claim`, "inspector", { version: 1 });
await call(`/inspections/${beginning}`, "other", undefined, 403);
await call(`/missions/${beginning}`, "inspector", {
  action: "re_edit",
  notes: "Corrigir a legenda sintética",
  expectedDeliveryVersion: 1,
});
await call(
  `/missions/${beginning}`,
  "voice",
  { action: "approve", expectedDeliveryVersion: 1 },
  409,
);
const corrected = await deliver(beginning, "beginner", 1);
await call(`/inspections/${beginning}/claim`, "inspector", { version: 2 });
await call(
  `/missions/${beginning}`,
  "inspector",
  { action: "approve", feedback: "Conferência antiga", expectedDeliveryVersion: 1 },
  409,
);
await call(`/missions/${beginning}`, "inspector", {
  action: "approve",
  feedback: "Legenda corrigida e conferida",
  expectedDeliveryVersion: 2,
});
await call(`/missions/${beginning}`, "voice", { action: "approve", expectedDeliveryVersion: 2 });
await call(`/missions/${beginning}/review`, "voice", {
  rating: 4,
  comment: "Ensaio sintético aprovado",
  expectedDeliveryVersion: 2,
});
ok("ajuste, versão corrigida, inspeção e avaliação real concluídos");
await call(`/inspections/${experienced}/claim`, "inspector", { version: 1 });
await call(`/missions/${experienced}`, "inspector", {
  action: "approve",
  feedback: "Primeira entrega experiente conferida",
  expectedDeliveryVersion: 1,
});
await call(`/missions/${experienced}`, "voice", { action: "approve", expectedDeliveryVersion: 1 });
for (const actor of ["beginner", "voice"]) await call("/inspections", actor, undefined, 403);
for (const path of ["/admin/users", "/admin/invitations", "/admin/ranking"])
  await call(path, "inspector", undefined, 403);
await call(
  `/missions/${beginning}/review`,
  "inspector",
  { rating: 5, expectedDeliveryVersion: 2 },
  403,
);
await call(
  `/admin/users/${accounts.beginner.id}`,
  "inspector",
  { verified: true, reason: "Escalação" },
  403,
);
await call("/profile", "inspector", { role: "admin" });
assert.equal((await call("/auth/session", "inspector")).data.role, "inspector");
ok("acesso cruzado, estrelas, selo e elevação de papel negados");
assert.equal((await fetch(corrected, { headers: { cookie: accounts.other.cookie } })).status, 403);
assert.equal(
  (await fetch(corrected, { headers: { cookie: accounts.inspector.cookie } })).status,
  200,
);
const sample = (await call("/portfolio", "beginner", { missionId: beginning, deliveryVersion: 2 }))
  .data;
await call(`/portfolio/${sample.id}`, "beginner", { action: "request", revision: 0 });
await call(`/portfolio/${sample.id}`, "voice", {
  action: "authorize",
  revision: 1,
  rightsConfirmed: true,
});
const sampleMedia = `${WEB}/api/portfolio/${sample.id}/media`;
assert.equal(
  (await fetch(sampleMedia, { headers: { cookie: accounts.experienced.cookie } })).status,
  200,
);
await call(`/portfolio/${sample.id}`, "inspector", { action: "revoke", revision: 2 }, 404);
await call(`/portfolio/${sample.id}`, "voice", { action: "revoke", revision: 2 });
assert.equal(
  (await fetch(sampleMedia, { headers: { cookie: accounts.experienced.cookie } })).status,
  404,
);
ok("publicação e revogação de portfólio preservadas");
await call("/admin/overview", "admin");
const evidence = await d1(
  `SELECT m.id,m.title,m.status,m.delivery_version,m.inspection_reason,i.version,i.decision,i.comment,i.inspector_id,i.inspected_at FROM missions m JOIN mission_inspections i ON i.mission_id=m.id WHERE m.id IN (${missions.join(",")}) ORDER BY m.id,i.version`,
);
await writeFile(
  `/tmp/oficina-onboarding-${stamp}-accounts.json`,
  JSON.stringify({ password, accounts, missions }, null, 2),
  { mode: 0o600 },
);
await writeFile(
  `/tmp/oficina-onboarding-${stamp}-evidence.json`,
  JSON.stringify(
    {
      stamp,
      checks,
      accounts: Object.fromEntries(
        Object.entries(accounts).map(([key, value]) => [
          key,
          { id: value.id, handle: value.handle, role: value.role },
        ]),
      ),
      missions,
      evidence,
    },
    null,
    2,
  ),
);
console.log(
  JSON.stringify({
    stamp,
    checks: checks.length,
    missions,
    evidenceFile: `/tmp/oficina-onboarding-${stamp}-evidence.json`,
  }),
);
