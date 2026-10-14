// Browser journey for the advanced chat and the dispute flow; every target is a fixed staging address.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";

const require = createRequire(import.meta.url),
  apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE ?? "/tmp/oficina-rbac-playwright/node_modules/playwright",
);
const run = promisify(execFile),
  WEB = "https://oficina-amarela-web-staging.casamarela.workers.dev";
assert.ok(process.argv[2], "Pass the evidence directory.");
const output = process.argv[2],
  stamp = Date.now(),
  password = "sintetica-chat-staging-123";
await mkdir(output, { recursive: true });
const hash = await apiRequire("bcryptjs").hash(password, 10),
  cases = [],
  createdHandles = [];
// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

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
    {
      env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: "53878b12fbc280f03fc30b5875f3522f" },
      maxBuffer: 8 * 1024 ** 2,
      timeout: 120000,
    },
  );
  return JSON.parse(stdout.slice(stdout.indexOf("[")))[0].results;
}

const browser = await chromium.launch({ headless: true });
const contexts = [];
let active;

function check(name) {
  active.checks.push(name);
  console.log(`OK ${active.viewport}: ${name}`);
}
async function snapshot(page, name) {
  await page.getByText(/^Carregando$/i, { exact: true }).waitFor({ state: "hidden" });
  await page.screenshot({ path: join(output, `${active.viewport}-${name}.png`), fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    `Horizontal overflow in ${name}`,
  );
  check(name);
}
async function goto(page, path) {
  await page.goto(`${WEB}${path}`, { waitUntil: "load" });
  const guide = page.getByRole("button", { name: "Fechar o guia", exact: true });
  // The how-to guide opens after hydration, so wait for it briefly before it can cover a click.
  if (
    await guide.waitFor({ state: "visible", timeout: 3000 }).then(
      () => true,
      () => false,
    )
  )
    await page.keyboard.press("Escape");
}
async function login(page, handle, landing) {
  await goto(page, "/login");
  await page.locator("#handle").fill(handle);
  await page.locator("#password").fill(password);
  await Promise.all([
    page.waitForResponse(
      (r) => new URL(r.url()).pathname === "/api/auth/login" && r.status() === 200,
    ),
    page.getByRole("button", { name: "Entrar na Oficina Amarela", exact: true }).click(),
  ]);
  await page.waitForURL(`${WEB}${landing}`);
}
const api = (context, path, method = "GET", data) =>
  context.request.fetch(`${WEB}/api${path}`, { method, ...(data === undefined ? {} : { data }) });
/** Click and wait for the mutation response on a path. */
async function act(page, click, path, status = 200) {
  const [r] = await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() !== "GET" && new URL(res.url()).pathname === path,
      {
        timeout: 45000,
      },
    ),
    click(),
  ]);
  assert.equal(r.status(), status, `${path}: HTTP ${r.status()}`);
  return r;
}

try {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    active = { viewport: viewport.name, checks: [], users: {} };
    cases.push(active);
    const pages = {};
    const roles = {
      voice: "voz",
      editor: "editor",
      outsider: "editor",
      inspector: "inspector",
      admin: "admin",
      reviewer: "admin",
    };
    for (const [actor, dbRole] of Object.entries(roles)) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.name === "mobile",
        hasTouch: viewport.name === "mobile",
      });
      await context.tracing.start({ snapshots: true });
      contexts.push({ context, actor, viewport: viewport.name });
      pages[actor] = await context.newPage();
      const handle = `cd.${viewport.name[0]}.${actor.slice(0, 4)}.${stamp}`;
      createdHandles.push(handle);
      const [row] = await sql(
        `INSERT INTO users(handle,name,email,role,password_hash,profile_completed,directory_visible,work_preference,sessions_valid_after) VALUES('${handle}','Synthetic ${viewport.name} ${actor}','${handle}@example.invalid','${dbRole}','${hash}',1,1,'volunteer','1970-01-01T00:00:00.000Z') RETURNING id`,
      );
      active.users[actor] = { handle, id: row.id };
    }
    const U = active.users;
    const { voice, editor, outsider, inspector, admin, reviewer } = pages;
    const [mission] = await sql(
      `INSERT INTO missions(spokesperson_id,reserved_by_id,title,format,status) VALUES(${U.voice.id},${U.editor.id},'Chat e disputa ${viewport.name} ${stamp}','short','reservada') RETURNING id`,
    );
    active.missionId = mission.id;
    const detail = `/porta-voz/missao/db-${mission.id}`;

    await login(voice, U.voice.handle, "/porta-voz");
    await login(editor, U.editor.handle, "/editor");
    await login(outsider, U.outsider.handle, "/editor");
    await login(inspector, U.inspector.handle, "/inspetor");
    await login(admin, U.admin.handle, "/inspetor");
    await login(reviewer, U.reviewer.handle, "/inspetor");

    // --- Chat: messages from the editor, unread banner for the spokesperson
    await goto(editor, "/editor");
    for (const text of ["Primeira mensagem", "Segunda mensagem"]) {
      await editor.getByPlaceholder("Escrever na conversa…").fill(text);
      await act(
        editor,
        () => editor.getByRole("button", { name: "Enviar", exact: true }).click(),
        `/api/missions/db-${mission.id}`,
      );
    }
    await goto(voice, "/porta-voz");
    await voice.getByText("Conversas com novidades").waitFor();
    await voice.getByText("2 novas").waitFor();
    await snapshot(voice, "chat-unread-banner");
    // opening the conversation marks it as read
    await Promise.all([
      voice.waitForResponse(
        (r) =>
          new URL(r.url()).pathname === `/api/missions/${mission.id}/read` ||
          new URL(r.url()).pathname === `/api/missions/db-${mission.id}/read`,
      ),
      voice
        .getByRole("link", { name: /Chat e disputa/ })
        .first()
        .click(),
    ]);
    await voice.waitForURL(`${WEB}${detail}`);
    await voice.getByText("Segunda mensagem", { exact: true }).waitFor();
    await snapshot(voice, "chat-conversation");
    await goto(voice, "/porta-voz");
    await voice.getByText("Conversas com novidades").waitFor({ state: "hidden", timeout: 15000 });
    check("unread-cleared-after-read");

    // --- Cursor by id: two messages with the same timestamp must both arrive
    await goto(voice, detail);
    const sameAt = "2026-10-14T12:00:00.000Z";
    await sql(
      `INSERT INTO messages(mission_id,author_id,body,created_at) VALUES(${mission.id},${U.editor.id},'Mesmo horário A','${sameAt}'),(${mission.id},${U.editor.id},'Mesmo horário B','${sameAt}')`,
    );
    await voice.getByText("Mesmo horário A", { exact: true }).waitFor({ timeout: 20000 });
    await voice.getByText("Mesmo horário B", { exact: true }).waitFor({ timeout: 20000 });
    check("same-timestamp-messages-both-delivered");

    // --- Lifecycle milestone from mission_notifications
    await sql(
      `INSERT INTO mission_notifications(key,mission_id,recipient_id,event,version) VALUES('mission:${mission.id}:submitted:1',${mission.id},${U.voice.id},'submitted',1)`,
    );
    await voice.getByText(/Entrega da versão 1 enviada/).waitFor({ timeout: 20000 });
    check("lifecycle-event-in-conversation");

    // --- Attachment: spokesperson sends, editor downloads, outsider is refused
    await voice.locator('input[type="file"][accept*="application/pdf"]').setInputFiles({
      name: "referencia.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await voice.getByPlaceholder("Escrever na conversa…").fill("Veja a referência");
    await act(
      voice,
      () => voice.getByRole("button", { name: "Enviar", exact: true }).click(),
      `/api/missions/db-${mission.id}/attachments`,
    );
    await voice.getByText(/referencia\.png/).waitFor();
    // Read the id from the database: Playwright cannot always read the body of a response the page already consumed.
    const [{ id: attachmentId }] = await sql(
      `SELECT id FROM message_attachments WHERE mission_id=${mission.id} ORDER BY id DESC LIMIT 1`,
    );
    await snapshot(voice, "chat-attachment-sent");
    await goto(editor, "/editor");
    await editor.getByText(/referencia\.png/).waitFor();
    const download = await api(
      editor.context(),
      `/missions/db-${mission.id}/attachments/${attachmentId}`,
    );
    assert.equal(download.status(), 200);
    assert.deepEqual(Buffer.from(await download.body()), PNG);
    assert.equal(
      (
        await api(outsider.context(), `/missions/db-${mission.id}/attachments/${attachmentId}`)
      ).status(),
      403,
    );
    assert.equal(
      (await api(outsider.context(), `/missions/db-${mission.id}?afterId=0`)).status(),
      403,
    );
    await snapshot(editor, "chat-attachment-received");
    check("attachment-isolated-from-outsider");

    // --- Dispute: open from the conversation
    await goto(voice, detail);
    await voice.getByRole("link", { name: "Abrir disputa", exact: true }).click();
    await voice.waitForURL(/\/disputas\/nova\?missao=/);
    await voice
      .getByLabel("O que aconteceu? (mínimo 10 caracteres)")
      .fill(`A entrega não seguiu o briefing combinado (${viewport.name}).`);
    await snapshot(voice, "dispute-form");
    await act(
      voice,
      () => voice.getByRole("button", { name: "Abrir disputa", exact: true }).click(),
      "/api/disputes",
      201,
    );
    await voice.waitForURL(/\/disputas\/\d+$/);
    const disputeId = Number(voice.url().split("/").pop());
    active.disputeId = disputeId;
    await snapshot(voice, "dispute-opened");

    // counterpart answers with a statement and a file
    await goto(editor, `/disputas/${disputeId}`);
    await editor
      .getByLabel("Manifestação", { exact: true })
      .fill("O briefing foi alterado depois da gravação.");
    await editor
      .locator('input[type="file"]')
      .setInputFiles({ name: "prova.png", mimeType: "image/png", buffer: PNG });
    await act(
      editor,
      () => editor.getByRole("button", { name: "Enviar", exact: true }).click(),
      `/api/disputes/${disputeId}/statements`,
      201,
    );
    await editor.getByRole("link", { name: "prova.png" }).waitFor();
    await snapshot(editor, "dispute-statement");

    // outsider cannot see the case; parties cannot take or decide
    assert.equal((await api(outsider.context(), `/disputes/${disputeId}`)).status(), 403);
    assert.equal(await voice.getByRole("button", { name: "Assumir a análise" }).count(), 0);

    // admin grants mediation; the granted inspector takes and decides
    assert.equal(
      (await api(admin.context(), `/disputes/mediators/${U.inspector.id}`, "PUT")).status(),
      200,
    );
    await goto(inspector, "/disputas");
    await inspector.getByRole("link", { name: "Disputas", exact: true }).first().waitFor();
    // The staff list shows every dispute, including those from earlier viewports.
    await inspector.locator(`a[href="/disputas/${disputeId}"]`).first().click();
    await inspector.waitForURL(`${WEB}/disputas/${disputeId}`);
    await act(
      inspector,
      () => inspector.getByRole("button", { name: "Assumir a análise" }).click(),
      `/api/disputes/${disputeId}/take`,
    );
    await inspector
      .getByLabel("Fundamentação")
      .fill("O briefing mudou depois da gravação; procede em parte.");
    await inspector.getByLabel("Resultado").selectOption("partially_upheld");
    await act(
      inspector,
      () => inspector.getByRole("button", { name: "Registrar decisão" }).click(),
      `/api/disputes/${disputeId}/decision`,
    );
    await inspector.getByText(/Decisão da mediação: Parcialmente procedente/).waitFor();
    assert.ok(
      await inspector.getByRole("link", { name: /Baixar o registro de evidências/ }).isVisible(),
    );
    await snapshot(inspector, "dispute-decided");
    // parties do not get the evidence capture link
    await goto(voice, `/disputas/${disputeId}`);
    assert.equal(
      await voice.getByRole("link", { name: /Baixar o registro de evidências/ }).count(),
      0,
    );

    // appeal by a party; another reviewer decides round 2 and the first decision stays
    await voice
      .getByLabel("Motivo do recurso")
      .fill("A decisão desconsiderou a referência enviada no chat.");
    await act(
      voice,
      () => voice.getByRole("button", { name: "Pedir revisão" }).click(),
      `/api/disputes/${disputeId}/appeal`,
      201,
    );
    await voice.getByRole("heading", { name: "Recurso" }).waitFor();
    // the first mediator cannot review their own decision
    assert.equal(
      (await api(inspector.context(), `/disputes/${disputeId}/take`, "POST")).status(),
      403,
    );
    await goto(reviewer, `/disputas/${disputeId}`);
    await act(
      reviewer,
      () => reviewer.getByRole("button", { name: "Assumir a análise" }).click(),
      `/api/disputes/${disputeId}/take`,
    );
    await reviewer.getByLabel("Fundamentação").fill("Em revisão, a decisão da mediação é mantida.");
    await reviewer.getByLabel("Resultado").selectOption("partially_upheld");
    await act(
      reviewer,
      () => reviewer.getByRole("button", { name: "Registrar decisão" }).click(),
      `/api/disputes/${disputeId}/decision`,
    );
    await reviewer.getByText(/Decisão do recurso/).waitFor();
    await reviewer.getByText(/Decisão da mediação/).waitFor();
    await snapshot(reviewer, "dispute-appeal-decided");

    // database: audit trail, no foreign key violations, and the mission is no longer flagged as disputed
    const audit = await sql(
      `SELECT action FROM admin_audit WHERE entity='dispute' AND entity_id='${disputeId}' ORDER BY id`,
    );
    assert.deepEqual(
      audit.map((a) => a.action),
      [
        "disputa_aberta",
        "disputa_assumida",
        "disputa_decidida",
        "disputa_recurso",
        "disputa_assumida",
        "disputa_decidida",
      ],
    );
    assert.deepEqual(await sql("PRAGMA foreign_key_check"), []);
    assert.deepEqual(
      await sql(`SELECT 1 FROM disputed_missions WHERE mission_id=${mission.id}`),
      [],
    );
    // revoking the grant is immediate
    assert.equal(
      (await api(admin.context(), `/disputes/mediators/${U.inspector.id}`, "DELETE")).status(),
      200,
    );
    check("audit-trail-and-grant-revocation");
    active.passed = true;
  }
} catch (error) {
  if (active) active.error = String(error);
  throw error;
} finally {
  if (createdHandles.length) {
    const list = createdHandles.map((h) => `'${h}'`).join(",");
    await sql(
      `DELETE FROM dispute_mediators WHERE user_id IN (SELECT id FROM users WHERE handle IN (${list}))`,
    );
    await sql(
      `UPDATE users SET is_banned=1,ban_reason='Synthetic chat/dispute run finished',sessions_valid_after=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE handle IN (${list})`,
    );
  }
  await writeFile(
    join(output, "resultado.json"),
    JSON.stringify({ createdAt: new Date().toISOString(), web: WEB, cases }, null, 2),
  );
  for (const { context, actor, viewport } of contexts) {
    if (browser.isConnected())
      await context.tracing.stop({ path: join(output, `${viewport}-${actor}-trace.zip`) });
    await context.close();
  }
  await browser.close();
}
