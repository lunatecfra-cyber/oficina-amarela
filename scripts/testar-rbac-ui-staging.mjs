// Ensaio real pela interface; todos os destinos são fixos de staging.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
assert.ok(process.argv[2], "Informe o diretório das evidências.");
const output = process.argv[2],
  stamp = Date.now(),
  password = "sintetica-rbac-staging-123";
await mkdir(output, { recursive: true });
const hash = await apiRequire("bcryptjs").hash(password, 10),
  cases = [],
  createdHandles = [];
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
    },
  );
  return JSON.parse(stdout.slice(stdout.indexOf("[")))[0].results;
}
const browser = await chromium.launch({ headless: true });
const contexts = [];
let active;
async function snapshot(page, name) {
  await page.getByText(/^Carregando$/i, { exact: true }).waitFor({ state: "hidden" });
  await page.screenshot({ path: join(output, `${active.viewport}-${name}.png`), fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2),
    `Overflow em ${name}`,
  );
  active.checks.push(name);
  console.log(`OK ${active.viewport}: ${name}`);
}
async function goto(page, path) {
  await page.goto(`${WEB}${path}`, { waitUntil: "networkidle" });
  const guide = page.getByRole("button", { name: "Fechar o guia", exact: true });
  if (await guide.isVisible()) await page.keyboard.press("Escape");
}
async function action(page, label, path, status = 200) {
  const [r] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() !== "GET" && new URL(r.url()).pathname === path,
      { timeout: 45000 },
    ),
    page.getByRole("button", { name: label, exact: true }).click(),
  ]);
  assert.equal(r.status(), status, `${label}: HTTP ${r.status()}`);
  return path === "/api/auth/signup" || path === "/api/missions" ? r.json() : null;
}
async function login(page, handle) {
  await goto(page, "/login");
  await page.locator("#handle").fill(handle);
  await page.locator("#password").fill(password);
  await action(page, "Entrar na Oficina Amarela", "/api/auth/login");
  await page.waitForURL(`${WEB}/inspetor`);
}
async function request(context, path, method = "GET", data) {
  const r = await context.request.fetch(`${WEB}/api${path}`, {
    method,
    ...(data === undefined ? {} : { data }),
  });
  return r;
}
try {
  const video = join(output, "sintetico.mp4");
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
  const bytes = await readFile(video),
    sha256 = createHash("sha256").update(bytes).digest("hex");
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    active = { viewport: viewport.name, checks: [], users: {}, sha256 };
    cases.push(active);
    const pages = {};
    for (const actor of ["admin", "inspector", "voice", "editor"]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.name === "mobile",
        hasTouch: viewport.name === "mobile",
        acceptDownloads: true,
      });
      await context.tracing.start({ snapshots: true });
      contexts.push({ context, actor, viewport: viewport.name });
      pages[actor] = await context.newPage();
      active.users[actor] = { handle: `e2.${viewport.name[0]}.${actor.slice(0, 3)}.${stamp}` };
      createdHandles.push(active.users[actor].handle);
    }
    for (const actor of ["admin", "inspector"]) {
      const user = active.users[actor];
      const [row] = await sql(
        `INSERT INTO users(handle,name,email,role,password_hash,profile_completed,sessions_valid_after) VALUES('${user.handle}','Synthetic ${viewport.name} ${actor}','${user.handle}@example.invalid','${actor}','${hash}',1,'1970-01-01T00:00:00.000Z') RETURNING id`,
      );
      user.id = row.id;
      await login(pages[actor], user.handle);
    }
    const adminContext = pages.admin.context();
    const email = `${active.users.voice.handle}@example.invalid`;
    const invite = await request(adminContext, "/admin/invitations", "POST", { email });
    assert.equal(invite.status(), 200);
    const { token } = await invite.json();
    await sql(
      `INSERT INTO admin_capabilities VALUES(${active.users.admin.id},'release_report_retention')`,
    );
    for (const actor of ["voice", "editor"]) {
      const page = pages[actor],
        user = active.users[actor];
      await goto(
        page,
        `/criar-conta${actor === "voice" ? `?convite=${encodeURIComponent(token)}` : ""}`,
      );
      await page.locator("#name").fill(`Synthetic ${viewport.name} ${actor}`);
      await page.locator("#handle").fill(user.handle);
      await page.locator("#email").fill(`${user.handle}@example.invalid`);
      await page.locator("#password").fill(password);
      await page.locator("#confirmPassword").fill(password);
      const data = await action(page, "Criar minha conta", "/api/auth/signup");
      user.id = data.id;
      await page.waitForURL(/criar-perfil/);
      await snapshot(page, `cadastro-${actor}`);
    }
    // Prerequisitos sintéticos de perfil; o aceite deste script cobre o cadastro, não o onboarding.
    await sql(
      `UPDATE users SET profile_completed=1,directory_visible=1,work_preference='volunteer',last_seen_at='1970-01-01T00:00:00.000Z' WHERE id IN (${active.users.editor.id},${active.users.voice.id})`,
    );
    const voice = pages.voice,
      editor = pages.editor,
      inspector = pages.inspector,
      admin = pages.admin;
    await goto(voice, "/porta-voz/nova-pauta");
    active.title = `RBAC visual ${viewport.name} ${stamp}`;
    await voice.getByPlaceholder("ex.: Corte sobre segurança no bairro").fill(active.title);
    await voice
      .getByPlaceholder("cole o link de compartilhamento")
      .fill("https://drive.google.com/file/d/synthetic-rbac-e2e/view");
    for (let i = 0; i < 4; i++)
      await voice.getByRole("button", { name: "Continuar", exact: true }).click();
    const mission = await action(voice, "Enviar missão", "/api/missions", 201);
    active.missionId = mission.id;
    await snapshot(voice, "missao-criada");
    const detail = `/porta-voz/missao/db-${mission.id}`;
    await goto(voice, detail);
    await voice.getByLabel("Convidar um editor diretamente").fill(active.users.editor.handle);
    await action(voice, "Convidar diretamente", `/api/missions/${mission.id}/selection`, 201);
    await snapshot(voice, "atribuicao-ofertada");
    await goto(editor, "/editor");
    await editor.getByRole("button", { name: "Receber ofertas", exact: true }).click();
    await action(editor, "Aceitar missão", "/api/editor/queue/next");
    await editor.getByRole("button", { name: "Confirmar entrega", exact: true }).waitFor();
    await snapshot(editor, "atribuicao-aceita");
    await editor
      .getByPlaceholder("Escrever na conversa…")
      .fill(`Conversa sintética ${viewport.name}`);
    await action(editor, "Enviar", `/api/missions/db-${mission.id}`);
    await goto(voice, detail);
    await voice.getByText(`Conversa sintética ${viewport.name}`, { exact: true }).waitFor();
    await snapshot(voice, "chat-privado");
    const urls = [];
    async function deliver(version) {
      await goto(editor, "/editor");
      const complete = editor.waitForResponse(
        (r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/complete"),
      );
      await editor.locator('input[type="file"]').setInputFiles(video);
      const uploaded = await complete;
      assert.equal(uploaded.status(), 200);
      const data = await uploaded.json();
      urls.push(data.readUrl);
      await editor.locator("#entrega").waitFor();
      await editor.waitForFunction(() =>
        document.querySelector("#entrega")?.value.includes("/files/"),
      );
      await action(editor, "Confirmar entrega", `/api/missions/db-${mission.id}`);
      await snapshot(editor, `entrega-v${version}`);
    }
    await deliver(1);
    await goto(voice, detail);
    assert.equal(
      await voice
        .getByRole("button", { name: "Aguardando fiscalização", exact: true })
        .isDisabled(),
      true,
    );
    await voice.getByRole("button", { name: "Pedir ajuste", exact: true }).click();
    await voice.getByLabel("O que precisa mudar?").fill("Reedição sintética: ajustar o título");
    await action(voice, "Enviar pro editor", `/api/missions/db-${mission.id}`);
    await snapshot(voice, "reedicao");
    await deliver(2);
    await goto(inspector, "/inspetor");
    const card = inspector.locator("li").filter({
      has: inspector.getByRole("heading", { name: `${active.title} · versão 2`, exact: true }),
    });
    await card.getByRole("button", { name: "Assumir e inspecionar", exact: true }).click();
    await inspector
      .getByLabel("Motivo da decisão", { exact: true })
      .fill("Entrega sintética e histórico conferidos na interface");
    assert.equal(await inspector.getByRole("link", { name: "Pessoas", exact: true }).count(), 0);
    assert.equal(await inspector.getByRole("link", { name: "Segurança", exact: true }).count(), 0);
    const inspectResponse = inspector.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === `/api/missions/db-${mission.id}`,
    );
    await inspector.getByRole("button", { name: "Aprovar tecnicamente", exact: true }).click();
    assert.equal((await inspectResponse).status(), 200);
    await snapshot(inspector, "inspecao-sem-admin");
    await goto(inspector, "/inspetor/contas");
    await inspector.waitForURL(`${WEB}/inspetor`);
    await snapshot(inspector, "rota-administrativa-negada");
    await goto(voice, detail);
    await action(voice, "Aceitar e postar", `/api/missions/db-${mission.id}`);
    await voice.getByLabel("4 ★", { exact: true }).check();
    await voice.getByLabel("Comentário opcional").fill("Aceite visual sintético");
    await action(voice, "Enviar avaliação", `/api/missions/db-${mission.id}/review`);
    await voice.getByText(/4 de 5 estrelas/).waitFor();
    await snapshot(voice, "aprovacao-avaliacao");
    await voice.getByRole("button", { name: "Denunciar esta missão", exact: true }).click();
    await voice.getByLabel("O que aconteceu?").fill(`Denúncia sintética ${viewport.name} ${stamp}`);
    await action(voice, "Enviar denúncia", `/api/missions/db-${mission.id}`);
    await snapshot(voice, "denuncia");
    const [report] = await sql(
      `SELECT id FROM reports WHERE mission_id=${mission.id} ORDER BY id DESC`,
    );
    active.reportId = report.id;
    await goto(inspector, "/inspetor/denuncias");
    const row = inspector.locator("li").filter({
      has: inspector.getByText(`Denúncia sintética ${viewport.name} ${stamp}`, { exact: true }),
    });
    assert.equal(
      await row.getByRole("button", { name: "Marcar resolvida", exact: true }).count(),
      0,
    );
    assert.equal(
      await row.getByRole("button", { name: "Liberar retenção", exact: true }).count(),
      0,
    );
    await row
      .getByLabel("Justificativa do encaminhamento")
      .fill("Encaminhar evidências à decisão administrativa");
    const forwarded = inspector.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === `/api/admin/reports/${report.id}/forward`,
    );
    await row.getByRole("button", { name: "Encaminhar ao administrador", exact: true }).click();
    assert.equal((await forwarded).status(), 200);
    await row.getByText(/Encaminhada por/).waitFor();
    const download = inspector.waitForEvent("download");
    await row.getByRole("link", { name: "Baixar registro preservado", exact: true }).click();
    const file = await download;
    await file.saveAs(join(output, `${viewport.name}-evidencia.json`));
    const capture = JSON.parse(
      await readFile(join(output, `${viewport.name}-evidencia.json`), "utf8"),
    );
    assert.equal(capture.evidence.filter((e) => e.kind === "delivery").length, 2);
    await snapshot(inspector, "encaminhamento-evidencias");
    await goto(admin, "/inspetor/denuncias");
    const adminRow = admin.locator("li").filter({
      has: admin.getByText(`Denúncia sintética ${viewport.name} ${stamp}`, { exact: true }),
    });
    await adminRow
      .getByLabel("Justificativa da decisão")
      .fill("Histórico sintético conferido; denúncia resolvida");
    const decided = admin.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === `/api/admin/reports/${report.id}/resolve`,
    );
    await adminRow.getByRole("button", { name: "Marcar resolvida", exact: true }).click();
    assert.equal((await decided).status(), 200);
    await adminRow.getByText(/Decisão de/).waitFor();
    await snapshot(admin, "decisao-auditada");
    await goto(editor, "/perfil/editar");
    await editor.getByRole("button", { name: "Apagar minha conta", exact: true }).click();
    await editor.getByPlaceholder("sua senha", { exact: true }).fill(password);
    await action(editor, "Apagar pra sempre", "/api/account", 409);
    await editor
      .getByRole("alert")
      .filter({ hasText: /retenção/ })
      .waitFor();
    await snapshot(editor, "exclusao-bloqueada");
    for (const url of urls) {
      const r = await request(voice.context(), new URL(url).pathname.replace(/^\/api/, ""));
      assert.equal(r.status(), 200);
      assert.equal(
        createHash("sha256")
          .update(await r.body())
          .digest("hex"),
        sha256,
      );
    }
    active.checks.push("bytes-v1-v2-preservados");
    await adminRow
      .getByLabel("Justificativa de liberação")
      .fill("Ensaio visual encerrado; retenção revisada");
    const released = admin.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === `/api/admin/reports/${report.id}/release-retention`,
    );
    await adminRow.getByRole("button", { name: "Liberar retenção", exact: true }).click();
    assert.equal((await released).status(), 200);
    await adminRow.getByText(/Retenção liberada em/).waitFor();
    await snapshot(admin, "retencao-liberada");
    await sql(
      `INSERT INTO user_capability_revocations VALUES(${active.users.inspector.id},'reports.read')`,
    );
    await goto(inspector, "/inspetor/denuncias");
    await inspector.waitForURL(`${WEB}/inspetor`);
    active.checks.push("revogacao-capacidade-pela-interface");
    await sql(`UPDATE users SET role='editor' WHERE id=${active.users.inspector.id}`);
    await goto(inspector, "/inspetor");
    await inspector.waitForURL(`${WEB}/login`);
    await snapshot(inspector, "revogacao-papel");
    active.database = {
      audit: await sql(
        `SELECT action,actor_id,details FROM admin_audit WHERE entity='report' AND entity_id='${report.id}'`,
      ),
      foreignKeys: await sql("PRAGMA foreign_key_check"),
    };
    assert.deepEqual(active.database.foreignKeys, []);
    assert.deepEqual(active.database.audit.map((a) => a.action).sort(), [
      "denuncia_decidida",
      "denuncia_encaminhada",
      "retencao_denuncia_liberada",
    ]);
    active.passed = true;
  }
} catch (error) {
  if (active) active.error = String(error);
  throw error;
} finally {
  if (createdHandles.length) {
    const list = createdHandles.map((h) => `'${h}'`).join(",");
    await sql(
      `DELETE FROM admin_capabilities WHERE user_id IN (SELECT id FROM users WHERE handle IN (${list}))`,
    );
    await sql(
      `UPDATE users SET is_banned=1,ban_reason='Ensaio visual sintético encerrado',sessions_valid_after=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE handle IN (${list})`,
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
