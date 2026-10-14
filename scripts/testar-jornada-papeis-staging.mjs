// Jornada completa por papel contra o STAGING, pela interface, em três viewports,
// com auditoria automática de responsividade e acessibilidade em cada tela.
//
//   PLAYWRIGHT_MODULE=/caminho/node_modules/playwright-core \
//     node scripts/testar-jornada-papeis-staging.mjs <diretório-das-evidências> \
//       [--viewports=mobile,tablet,desktop] [--quick]
//
// --quick roda só o visitante anônimo (sem escrever no D1): serve para depurar a
// auditoria. Sem --quick o script cria usuários sintéticos no D1 de staging e, ao
// final, bane todos eles. Nunca aponta para produção: todos os destinos são fixos.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const apiRequire = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright-core");
const run = promisify(execFile);

const WEB = "https://oficina-amarela-web-staging.casamarela.workers.dev";
const ACCOUNT_ID = "53878b12fbc280f03fc30b5875f3522f";
const VIEWPORTS = {
  mobile: { width: 390, height: 844, touch: true },
  tablet: { width: 768, height: 1024, touch: true },
  desktop: { width: 1440, height: 900, touch: false },
};

const args = process.argv.slice(2);
const output = args.find((a) => !a.startsWith("--"));
assert.ok(output, "Informe o diretório das evidências.");
const quick = args.includes("--quick");
const wanted = (args.find((a) => a.startsWith("--viewports="))?.split("=")[1] ?? "mobile,tablet,desktop")
  .split(",")
  .map((name) => {
    assert.ok(VIEWPORTS[name], `Viewport desconhecido: ${name}`);
    return { name, ...VIEWPORTS[name] };
  });

const stamp = Date.now();
const password = "sintetica-jornada-staging-123";
await mkdir(output, { recursive: true });

async function sql(command) {
  const { stdout } = await run(
    "bunx",
    [
      "wrangler", "d1", "execute", "oficina-amarela-staging", "--remote", "--env", "staging",
      "--config", "apps/api/wrangler.jsonc", "--json", "--command", command,
    ],
    { env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID }, maxBuffer: 8 * 1024 ** 2 },
  );
  return JSON.parse(stdout.slice(stdout.indexOf("[")))[0].results;
}

// ── Auditoria executada dentro da página ────────────────────────────────────
// Devolve achados {kind, severity, target, detail}. "error" reprova o critério;
// "warning" é registrado como defeito reproduzível mas não derruba a jornada.
function auditInPage({ touch }) {
  const findings = [];
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ""}${text ? ` "${text}"` : ""}`;
  };
  const add = (kind, severity, el, detail) =>
    findings.push({ kind, severity, target: el ? describe(el) : "document", detail });
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };

  // Overflow horizontal: aponta quem passa da borda.
  const vw = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > vw + 1) {
    const culprits = [...document.querySelectorAll("body *")]
      .filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1)
      .slice(0, 3);
    for (const el of culprits) add("overflow", "error", el, `direita em ${Math.round(el.getBoundingClientRect().right)}px > ${vw}px`);
    if (!culprits.length) add("overflow", "error", null, `scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
  }

  // Idioma, título e estrutura mínima.
  if (!document.documentElement.lang) add("lang", "error", null, "html sem atributo lang");
  if (!document.title.trim()) add("title", "warning", null, "página sem <title>");
  if (!document.querySelector("main")) add("landmark", "warning", null, "sem landmark <main>");
  const h1 = [...document.querySelectorAll("h1")].filter(visible);
  if (h1.length !== 1) add("h1", "warning", h1[0] ?? null, `${h1.length} títulos h1 visíveis`);

  // Nome acessível de controles e alt de imagens.
  const nameOf = (el) => {
    const aria = el.getAttribute("aria-label")?.trim();
    if (aria) return aria;
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim();
      if (t) return t;
    }
    if (el.labels?.length) {
      const t = [...el.labels].map((l) => l.textContent).join(" ").trim();
      if (t) return t;
    }
    const own = (el.textContent ?? "").trim();
    if (own) return own;
    const img = el.querySelector("img[alt]")?.getAttribute("alt")?.trim();
    if (img) return img;
    return el.getAttribute("title")?.trim() ?? "";
  };
  for (const el of document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab]")) {
    if (!visible(el) && el.type !== "file") continue;
    if (el.type === "file" && !el.closest("label") && !visible(el)) continue;
    if (!nameOf(el)) {
      add(
        el.getAttribute("placeholder") ? "name-placeholder" : "name-missing",
        el.getAttribute("placeholder") ? "warning" : "error",
        el,
        el.getAttribute("placeholder") ? "só o placeholder nomeia o campo" : "controle sem nome acessível",
      );
    }
  }
  for (const img of document.querySelectorAll("img")) {
    if (visible(img) && !img.hasAttribute("alt")) add("img-alt", "error", img, "imagem sem atributo alt");
  }

  // Alvos de toque. Links em linha de texto são isentos (WCAG 2.5.8).
  const minWarn = touch ? 44 : 24;
  for (const el of document.querySelectorAll("a[href], button, select, [role=button], [role=tab], input:not([type=hidden])")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    if (el.tagName === "A" && s.display === "inline") continue;
    let box = el;
    if (el.type === "checkbox" || el.type === "radio") box = el.closest("label") ?? el;
    const r = box.getBoundingClientRect();
    const h = Math.round(r.height);
    const w = Math.round(r.width);
    if (h < 24 || w < 24) add("tap-target", "error", el, `${w}×${h}px (mínimo WCAG 24px)`);
    else if (h < minWarn - 1 && w < minWarn - 1) add("tap-target", "warning", el, `${w}×${h}px (convenção do projeto: ${minWarn}px)`);
  }

  // Contraste de texto: compõe o fundo subindo pelos ancestrais; pula fundos com gradiente/imagem.
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  ctx.canvas.width = ctx.canvas.height = 1;
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const backdrop = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage !== "none") return null;
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 0.99) break;
    }
    let base = [8, 8, 10];
    for (const [r, g, b, a] of layers.reverse()) base = [r * a + base[0] * (1 - a), g * a + base[1] * (1 - a), b * a + base[2] * (1 - a)];
    return base;
  };
  const seen = new Set();
  let reported = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (reported >= 14) break;
    if (!visible(el) || el.closest("[aria-hidden=true]") || el.disabled) continue;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el);
    if (s.webkitTextFillColor === "rgba(0, 0, 0, 0)" || s.color === "rgba(0, 0, 0, 0)") continue;
    const bg = backdrop(el);
    if (!bg) continue;
    let [r, g, b, a] = rgba(s.color);
    for (let n = el; n; n = n.parentElement) a *= Number(getComputedStyle(n).opacity);
    const fg = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)];
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const ratio = (hi + 0.05) / (lo + 0.05);
    const px = parseFloat(s.fontSize);
    const large = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const need = large ? 3 : 4.5;
    if (ratio >= need) continue;
    const key = `${s.color}|${bg.map(Math.round)}|${px}`;
    if (seen.has(key)) continue;
    seen.add(key);
    reported++;
    add("contrast", ratio < 3 ? "error" : "warning", el, `contraste ${ratio.toFixed(2)}:1 (mínimo ${need}:1), fonte ${px}px`);
  }
  return findings;
}

// Foco por teclado: Tab alguns passos e confere que há indicador visível.
async function keyboardAudit(page) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Tab");
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      const outline = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
      const shadow = s.boxShadow !== "none";
      return { tag: el.tagName.toLowerCase(), text: (el.textContent ?? "").trim().slice(0, 30), indicator: outline || shadow };
    });
    if (info && !info.indicator) out.push({ kind: "focus-indicator", severity: "error", target: `${info.tag} "${info.text}"`, detail: "foco por teclado sem indicador visível" });
  }
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    window.scrollTo(0, 0);
  });
  return out;
}

// ── Execução ────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true });
const cases = [];
const contexts = [];
const createdHandles = [];
let hash = null;
if (!quick) hash = await apiRequire("bcryptjs").hash(password, 10);

// Contas sintéticas nunca ficam ativas: o encerramento normal, o erro e o sinal do
// sistema (SIGTERM/SIGINT/SIGHUP) passam por aqui.
let cleaned = false;
async function cleanupUsers() {
  if (cleaned || !createdHandles.length) return;
  cleaned = true;
  const list = createdHandles.map((h) => `'${h}'`).join(",");
  await sql(`DELETE FROM admin_capabilities WHERE user_id IN (SELECT id FROM users WHERE handle IN (${list}))`).catch(() => {});
  await sql(`UPDATE users SET is_banned=1,ban_reason='Jornada sintética encerrada',sessions_valid_after=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE handle IN (${list})`).catch(() => {});
}
for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => {
    console.error(`Sinal ${signal}: encerrando contas sintéticas antes de sair.`);
    cleanupUsers().finally(() => process.exit(130));
  });
}

// Vigia: se nada avança por 75 s, registra URL, tela e estado de cada página,
// para o travamento aparecer como evidência em vez de silêncio.
let lastProgress = Date.now();
let lastOp = "início";
let stallReports = 0;
const touch = () => {
  lastProgress = Date.now();
};
const origLog = console.log;
console.log = (...a) => {
  touch();
  origLog(...a);
};
setInterval(async () => {
  if (Date.now() - lastProgress < 45_000 || stallReports >= 2) return;
  stallReports++;
  console.error(`VIGIA: sem progresso há ${Math.round((Date.now() - lastProgress) / 1000)} s; última operação: ${lastOp}`);
  for (const { context, actor, viewport } of contexts) {
    for (const page of context.pages()) {
      const state = await Promise.race([
        page.evaluate(() => ({ ready: document.readyState, busy: !!document.querySelector("[aria-busy=true]"), buttons: [...document.querySelectorAll("button:disabled")].map((b) => (b.textContent ?? "").trim().slice(0, 30)).slice(0, 5) })).catch((e) => `evaluate falhou: ${e}`),
        new Promise((r) => setTimeout(() => r("evaluate sem resposta em 5 s (thread principal presa?)"), 5000)),
      ]);
      console.error(`VIGIA ${viewport}/${actor}: ${page.url()} ${JSON.stringify(state)}`);
      await Promise.race([page.screenshot({ path: join(output, `${viewport}-VIGIA-${actor}.png`) }).catch(() => {}), new Promise((r) => setTimeout(r, 8000))]);
    }
  }
  touch();
}, 15_000).unref();

try {
  for (const viewport of wanted) {
    const active = { viewport: viewport.name, size: `${viewport.width}x${viewport.height}`, checks: [], steps: [], findings: [], consoleErrors: [], serverErrors: [], guidesClosed: [], users: {} };
    cases.push(active);
    let currentStep = "início";

    const newActor = async (actor) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.touch && viewport.name === "mobile",
        hasTouch: viewport.touch,
        acceptDownloads: true,
        locale: "pt-BR",
      });
      await context.tracing.start({ screenshots: true, snapshots: true });
      contexts.push({ context, actor, viewport: viewport.name });
      const page = await context.newPage();
      page.actor = actor;
      page.guideChecks = new Map();
      page.on("console", (m) => {
        if (m.type() === "error" && !/favicon|Failed to load resource.*(401|403|404|409|429)/.test(m.text())) active.consoleErrors.push({ actor, page: new URL(page.url()).pathname, text: m.text().slice(0, 200) });
      });
      page.on("pageerror", (e) => active.consoleErrors.push({ actor, page: new URL(page.url()).pathname, text: `pageerror: ${String(e).slice(0, 200)}` }));
      page.on("response", (r) => {
        if (r.status() >= 500) active.serverErrors.push({ actor, status: r.status(), url: new URL(r.url()).pathname, method: r.request().method() });
      });
      return page;
    };

    // O guia abre sozinho ~900 ms depois do carregamento, por rota. Esc fecha (é o
    // contrato do componente); clicar no backdrop falha quando o balão o cobre.
    async function dismissGuide(page) {
      lastOp = `dismissGuide ${page.actor} ${page.url()}`;
      await page.waitForLoadState("networkidle").catch(() => {});
      const key = new URL(page.url()).pathname;
      // O guia abre ~900 ms depois da hidratação, e sob carga demora mais: cada rota
      // é checada até 2 vezes antes de ser dada como "sem guia".
      if ((page.guideChecks.get(key) ?? 0) >= 2) return;
      const dialog = page.getByRole("dialog");
      try {
        await dialog.waitFor({ state: "visible", timeout: 2500 });
      } catch {
        page.guideChecks.set(key, (page.guideChecks.get(key) ?? 0) + 1);
        return;
      }
      page.guideChecks.set(key, 2);
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden", timeout: 3000 });
      active.guidesClosed.push(`${page.actor}:${key}`);
    }
    async function goto(page, path) {
      lastOp = `goto ${page.actor} ${path}`;
      await page.goto(`${WEB}${path}`, { waitUntil: "networkidle" });
      await dismissGuide(page);
    }
    async function snapshot(page, name, { audit = true } = {}) {
      lastOp = `snapshot ${name}: captura`;
      await page.screenshot({ path: join(output, `${viewport.name}-${name}.png`), fullPage: true });
      active.checks.push(name);
      if (audit) {
        lastOp = `snapshot ${name}: auditoria`;
        const found = [...(await page.evaluate(auditInPage, { touch: viewport.touch })), ...(await keyboardAudit(page))];
        for (const f of found) active.findings.push({ screen: name, actor: page.actor, ...f });
        const overflow = found.find((f) => f.kind === "overflow");
        assert.ok(!overflow, `Overflow horizontal em ${name}: ${overflow?.target} ${overflow?.detail}`);
      }
      console.log(`OK ${viewport.name}: ${name}`);
    }
    async function action(page, label, path, status = 200) {
      lastOp = `action ${page.actor} "${label}" -> ${path}`;
      const [r] = await Promise.all([
        page.waitForResponse((res) => res.request().method() !== "GET" && new URL(res.url()).pathname === path, { timeout: 45000 }),
        page.getByRole("button", { name: label, exact: true }).click(),
      ]);
      // O corpo só é lido quando precisa: após um router.push o navegador descarta
      // a resposta e a leitura nunca retorna; por isso também há limite de tempo.
      const body = () =>
        Promise.race([r.json().catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), 3000))]);
      if (r.status() !== status) assert.fail(`${label}: HTTP ${r.status()} ${JSON.stringify(await body())}`);
      return body();
    }
    async function step(name, fn) {
      currentStep = name;
      lastOp = `passo ${name}`;
      const started = Date.now();
      // Passo que não termina em 4 min reprova com nome, em vez de travar a execução.
      let timer;
      await Promise.race([
        fn(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error(`passo excedeu 240 s`)), 240_000);
        }),
      ]).finally(() => clearTimeout(timer));
      active.steps.push({ name, ms: Date.now() - started });
    }
    const api = (context, path, method = "GET", data) =>
      context.request.fetch(`${WEB}/api${path}`, { method, ...(data === undefined ? {} : { data }) });

    try {
      // 1. Visitante: entrada pública e caminhos de cadastro/login.
      await step("visitante", async () => {
        const visitor = await newActor("visitante");
        await goto(visitor, "/");
        await snapshot(visitor, "visitante-entrada");
        assert.ok((await visitor.locator('a[href="/login"], a[href^="/criar-conta"]').count()) > 0, "A entrada pública precisa levar a login ou cadastro.");
        await goto(visitor, "/login");
        await snapshot(visitor, "visitante-login");
        await goto(visitor, "/criar-conta");
        await snapshot(visitor, "visitante-criar-conta");
        for (const path of ["/editor", "/porta-voz", "/inspetor"]) {
          await visitor.goto(`${WEB}${path}`, { waitUntil: "networkidle" });
          assert.ok(!new URL(visitor.url()).pathname.startsWith(path), `Visitante não pode permanecer em ${path}`);
        }
        active.checks.push("visitante-negado-nas-areas-privadas");
      });
      if (quick) {
        active.passed = true;
        continue;
      }

      const pages = {};
      const users = active.users;
      for (const actor of ["admin", "inspector", "voice", "editor"]) {
        pages[actor] = await newActor(actor);
        users[actor] = { handle: `jp.${viewport.name[0]}.${actor.slice(0, 3)}.${stamp}` };
        createdHandles.push(users[actor].handle);
      }
      const { admin, inspector, voice, editor } = pages;

      // 2. Inspetor e administrador entram pela tela de login.
      await step("login administrativo", async () => {
        for (const actor of ["admin", "inspector"]) {
          const user = users[actor];
          const [row] = await sql(`INSERT INTO users(handle,name,email,role,password_hash,profile_completed,sessions_valid_after) VALUES('${user.handle}','Sintético ${viewport.name} ${actor}','${user.handle}@example.invalid','${actor}','${hash}',1,'1970-01-01T00:00:00.000Z') RETURNING id`);
          user.id = row.id;
          await goto(pages[actor], "/login");
          await pages[actor].locator("#handle").fill(user.handle);
          await pages[actor].locator("#password").fill(password);
          await action(pages[actor], "Entrar na Oficina Amarela", "/api/auth/login");
          await pages[actor].waitForURL(`${WEB}/inspetor`);
        }
        await sql(`INSERT INTO admin_capabilities VALUES(${users.admin.id},'release_report_retention')`);
      });

      // 3. Entrada de porta-voz e editor. O cadastro pela interface tem limite por IP
      // (3 por 15 min, proteção real); por isso só o primeiro viewport da execução
      // se cadastra: porta-voz por convite administrativo, editor aberto. Nos demais
      // as contas nascem sem perfil no D1 e entram pela tela de login.
      const signupViaUi = viewport === wanted[0] && !args.includes("--sem-cadastro");
      await step(signupViaUi ? "cadastro" : "login de porta-voz e editor", async () => {
        if (signupViaUi) {
          const email = `${users.voice.handle}@example.invalid`;
          const invite = await api(admin.context(), "/admin/invitations", "POST", { email });
          assert.equal(invite.status(), 200);
          const { token } = await invite.json();
          for (const actor of ["voice", "editor"]) {
            const page = pages[actor];
            const user = users[actor];
            await goto(page, `/criar-conta${actor === "voice" ? `?convite=${encodeURIComponent(token)}` : ""}`);
            await page.locator("#name").fill(`Sintético ${viewport.name} ${actor}`);
            await page.locator("#handle").fill(user.handle);
            await page.locator("#email").fill(`${user.handle}@example.invalid`);
            await page.locator("#password").fill(password);
            await page.locator("#confirmPassword").fill(password);
            const data = await action(page, "Criar minha conta", "/api/auth/signup");
            user.id = data.id;
            await page.waitForURL(/criar-perfil/);
            await dismissGuide(page);
            await snapshot(page, `cadastro-${actor}`);
          }
          return;
        }
        for (const [actor, role] of [["voice", "voz"], ["editor", "editor"]]) {
          const page = pages[actor];
          const user = users[actor];
          const [row] = await sql(`INSERT INTO users(handle,name,email,role,password_hash,profile_completed,sessions_valid_after) VALUES('${user.handle}','Sintético ${viewport.name} ${actor}','${user.handle}@example.invalid','${role}','${hash}',0,'1970-01-01T00:00:00.000Z') RETURNING id`);
          user.id = row.id;
          await goto(page, "/login");
          await page.locator("#handle").fill(user.handle);
          await page.locator("#password").fill(password);
          await action(page, "Entrar na Oficina Amarela", "/api/auth/login");
          await page.waitForURL((url) => !url.pathname.startsWith("/login"));
          await dismissGuide(page);
        }
      });

      // 4. Onboarding do editor pela interface (ONCA-102): perfil, especialidade,
      // preferência de trabalho voluntária e consentimento do diretório.
      await step("onboarding do editor", async () => {
        if (!signupViaUi) await goto(editor, "/editor/criar-perfil");
        await editor.locator("#name").fill(`Editor Sintético ${viewport.name}`);
        await editor.locator('section button[aria-pressed="false"]').first().click();
        await editor.locator("#bio").fill("Edito cortes curtos para redes, com legenda e ritmo rápido.");
        await snapshot(editor, "onboarding-identidade");
        await editor.getByRole("button", { name: "Avançar →", exact: true }).click();
        const pick = (title) => editor.locator("section > div", { has: editor.getByRole("heading", { name: title, exact: true }) }).locator("button[aria-pressed]").first().click();
        await pick("Nível de edição");
        await pick("Poder de processamento");
        await pick("Ferramentas");
        await pick("Seu estilo");
        await snapshot(editor, "onboarding-bancada");
        await editor.getByRole("button", { name: "Avançar →", exact: true }).click();
        await editor.getByLabel("Link do portfólio").fill("https://drive.google.com/file/d/synthetic-onboarding/view");
        await pick("Nicho de atuação");
        await editor.getByLabel("Preferência de trabalho").selectOption("volunteer");
        await editor.getByLabel(/Autorizo publicar meu perfil/).check();
        await action(editor, "Salvar visibilidade", "/api/editors/visibility");
        await snapshot(editor, "onboarding-portfolio-consentimento");
        await action(editor, "Concluir e ver a fila", "/api/editor/profile");
        await editor.waitForURL(`${WEB}/editor`);
        await dismissGuide(editor);
        await snapshot(editor, "editor-fila-inicial");
        const [row] = await sql(`SELECT profile_completed AS done, directory_visible AS visible, work_preference AS pref FROM users WHERE id=${users.editor.id}`);
        assert.ok(row.done && row.visible && row.pref === "volunteer", `Onboarding não persistiu: ${JSON.stringify(row)}`);
        active.checks.push("onboarding-persistido");
        // O perfil do porta-voz está fora deste ensaio; "visto agora" mantém o editor disponível.
        await sql(`UPDATE users SET profile_completed=1,last_seen_at='2099-01-01T00:00:00.000Z' WHERE id IN (${users.editor.id},${users.voice.id})`);
      });

      // 5. Porta-voz: encontra o editor no diretório, cria a missão e convida.
      let detail;
      await step("porta-voz: diretório, missão e convite", async () => {
        await goto(voice, "/porta-voz");
        await snapshot(voice, "porta-voz-sem-missoes");
        await voice.getByRole("link", { name: "Consultar diretório de editores", exact: true }).click();
        await voice.waitForURL(`${WEB}/editores`);
        await voice.getByLabel("Nome ou apelido").fill(users.editor.handle);
        await voice.getByRole("button", { name: "Buscar editores", exact: true }).click();
        await voice.getByText(`@${users.editor.handle}`, { exact: true }).waitFor();
        await snapshot(voice, "diretorio-editores");
        await goto(voice, "/porta-voz/nova-pauta");
        active.title = `Jornada ${viewport.name} ${stamp}`;
        await voice.getByPlaceholder("ex.: Corte sobre segurança no bairro").fill(active.title);
        await voice.getByPlaceholder("cole o link de compartilhamento").fill("https://drive.google.com/file/d/synthetic-journey/view");
        for (let i = 0; i < 4; i++) await voice.getByRole("button", { name: "Continuar", exact: true }).click();
        const mission = await action(voice, "Enviar missão", "/api/missions", 201);
        active.missionId = mission.id;
        await snapshot(voice, "missao-criada");
        detail = `/porta-voz/missao/db-${mission.id}`;
        await goto(voice, detail);
        await voice.getByLabel("Convidar um editor diretamente").fill(users.editor.handle);
        await action(voice, "Convidar diretamente", `/api/missions/${mission.id}/selection`, 201);
        await snapshot(voice, "atribuicao-ofertada");
      });

      // 6. Editor: aceita, conversa, entrega duas versões; porta-voz pede ajuste.
      const video = join(output, "sintetico.mp4");
      await run("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=yellow:s=160x90:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-y", video]);
      const sha256 = createHash("sha256").update(await readFile(video)).digest("hex");
      const urls = [];
      async function deliver(version) {
        await goto(editor, "/editor");
        const complete = editor.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/complete"));
        await editor.locator('input[type="file"]').setInputFiles(video);
        const uploaded = await complete;
        assert.equal(uploaded.status(), 200);
        urls.push((await uploaded.json()).readUrl);
        await editor.locator("#entrega").waitFor();
        await editor.waitForFunction(() => document.querySelector("#entrega")?.value.includes("/files/"));
        await action(editor, "Confirmar entrega", `/api/missions/db-${active.missionId}`);
        await snapshot(editor, `entrega-v${version}`);
      }
      await step("editor: aceite, conversa e entregas", async () => {
        await goto(editor, "/editor");
        await editor.getByRole("button", { name: "Receber ofertas", exact: true }).click();
        await action(editor, "Aceitar missão", "/api/editor/queue/next");
        await editor.getByRole("button", { name: "Confirmar entrega", exact: true }).waitFor();
        await snapshot(editor, "atribuicao-aceita");
        await editor.getByPlaceholder("Escrever na conversa…").fill(`Conversa sintética ${viewport.name}`);
        await action(editor, "Enviar", `/api/missions/db-${active.missionId}`);
        await goto(voice, detail);
        await voice.getByText(`Conversa sintética ${viewport.name}`, { exact: true }).waitFor();
        await snapshot(voice, "chat-privado");
        await deliver(1);
        await goto(voice, detail);
        assert.equal(await voice.getByRole("button", { name: "Aguardando fiscalização", exact: true }).isDisabled(), true);
        await voice.getByRole("button", { name: "Pedir ajuste", exact: true }).click();
        await voice.getByLabel("O que precisa mudar?").fill("Reedição sintética: ajustar o título");
        await action(voice, "Enviar pro editor", `/api/missions/db-${active.missionId}`);
        await snapshot(voice, "reedicao");
        await deliver(2);
      });

      // 7. Inspetor: fila, assumir, decisão técnica; sem acesso administrativo.
      await step("inspetor: fila e decisão técnica", async () => {
        await goto(inspector, "/inspetor");
        const card = inspector.locator("li").filter({ has: inspector.getByRole("heading", { name: `${active.title} · versão 2`, exact: true }) });
        await card.waitFor();
        await snapshot(inspector, "inspetor-fila");
        assert.equal(await inspector.getByRole("link", { name: "Pessoas", exact: true }).count(), 0);
        assert.equal(await inspector.getByRole("link", { name: "Segurança", exact: true }).count(), 0);
        await card.getByRole("button", { name: "Assumir e inspecionar", exact: true }).click();
        await inspector.getByRole("region", { name: "Inspeção da versão" }).waitFor();
        await inspector.getByLabel("Motivo da decisão").fill("Conferido tecnicamente: áudio e corte conforme o briefing.");
        await snapshot(inspector, "inspetor-decisao");
        await action(inspector, "Aprovar tecnicamente", `/api/missions/db-${active.missionId}`);
        await inspector.getByText(/Inspeção aprovada/).waitFor();
        await snapshot(inspector, "inspetor-aprovada");
        await goto(inspector, "/inspetor/contas");
        await inspector.waitForURL(`${WEB}/inspetor`);
        await snapshot(inspector, "rota-administrativa-negada");
      });

      // 8. Porta-voz aprova, avalia e denuncia; inspetor encaminha; admin decide.
      await step("aprovação, avaliação e denúncia", async () => {
        await goto(voice, detail);
        await action(voice, "Aceitar e postar", `/api/missions/db-${active.missionId}`);
        await voice.getByLabel("4 ★", { exact: true }).check();
        await voice.getByLabel("Comentário opcional").fill("Aceite sintético da jornada");
        await action(voice, "Enviar avaliação", `/api/missions/${active.missionId}/review`);
        await voice.getByText(/4 de 5 estrelas/).waitFor();
        await snapshot(voice, "aprovacao-avaliacao");
        await voice.getByRole("button", { name: "Denunciar esta missão", exact: true }).click();
        await voice.getByLabel("O que aconteceu?").fill(`Denúncia sintética ${viewport.name} ${stamp}`);
        await action(voice, "Enviar denúncia", `/api/missions/db-${active.missionId}`);
        await snapshot(voice, "denuncia");
        const [report] = await sql(`SELECT id FROM reports WHERE mission_id=${active.missionId} ORDER BY id DESC`);
        active.reportId = report.id;
      });
      await step("denúncia: encaminhamento e decisão", async () => {
        const text = `Denúncia sintética ${viewport.name} ${stamp}`;
        await goto(inspector, "/inspetor/denuncias");
        const row = inspector.locator("li").filter({ has: inspector.getByText(text, { exact: true }) });
        assert.equal(await row.getByRole("button", { name: "Marcar resolvida", exact: true }).count(), 0);
        assert.equal(await row.getByRole("button", { name: "Liberar retenção", exact: true }).count(), 0);
        await row.getByLabel("Justificativa do encaminhamento").fill("Encaminhar evidências à decisão administrativa");
        const forwarded = inspector.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/admin/reports/${active.reportId}/forward`);
        await row.getByRole("button", { name: "Encaminhar ao administrador", exact: true }).click();
        assert.equal((await forwarded).status(), 200);
        await row.getByText(/Encaminhada por/).waitFor();
        await snapshot(inspector, "encaminhamento-evidencias");
        await goto(admin, "/inspetor/denuncias");
        const adminRow = admin.locator("li").filter({ has: admin.getByText(text, { exact: true }) });
        await adminRow.getByLabel("Justificativa da decisão").fill("Histórico sintético conferido; denúncia resolvida");
        const decided = admin.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/admin/reports/${active.reportId}/resolve`);
        await adminRow.getByRole("button", { name: "Marcar resolvida", exact: true }).click();
        assert.equal((await decided).status(), 200);
        await adminRow.getByText(/Decisão de/).waitFor();
        await snapshot(admin, "decisao-auditada");
        // bytes das duas versões seguem intactos no R2 enquanto a retenção vale
        for (const url of urls) {
          const r = await api(voice.context(), new URL(url).pathname.replace(/^\/api/, ""));
          assert.equal(r.status(), 200);
          assert.equal(createHash("sha256").update(await r.body()).digest("hex"), sha256);
        }
        active.checks.push("bytes-v1-v2-preservados");
      });

      // 9. Visão operacional do administrador (sem consulta manual ao banco).
      await step("administrador: visão operacional", async () => {
        for (const [path, name] of [["/inspetor/panorama", "admin-panorama"], ["/inspetor/contas", "admin-pessoas-convites"], ["/inspetor/notificacoes", "admin-alertas"], ["/inspetor/seguranca", "admin-seguranca"], ["/inspetor/novidades", "admin-novidades"]]) {
          await goto(admin, path);
          await snapshot(admin, name);
        }
      });

      // 10. Telas principais de cada papel com dados reais já criados.
      await step("telas por papel", async () => {
        for (const [page, path, name] of [
          [editor, "/agenda", "editor-agenda"],
          [editor, "/perfil", "editor-perfil"],
          [editor, "/portfolio", "editor-portfolio"],
          [editor, "/ranking", "editor-ranking"],
          [voice, "/porta-voz", "porta-voz-com-missao"],
          [voice, "/porta-voz/perfil", "porta-voz-perfil"],
          [inspector, "/inspetor", "inspetor-fila-vazia-ou-historico"],
        ]) {
          await goto(page, path);
          await snapshot(page, name);
        }
        for (const [page, path, expected] of [[voice, "/inspetor/contas", /\/porta-voz/], [voice, "/editor", /\/porta-voz/], [editor, "/porta-voz", /\/editor/], [editor, "/inspetor", /\/editor/]]) {
          await page.goto(`${WEB}${path}`, { waitUntil: "networkidle" });
          assert.match(new URL(page.url()).pathname, expected, `${page.actor} em ${path} terminou em ${page.url()}`);
        }
        active.checks.push("negacao-por-papel");
      });

      // 11. Exclusão bloqueada pela retenção, liberação e revogações.
      await step("retenção e revogações", async () => {
        await goto(editor, "/perfil/editar");
        await editor.getByRole("button", { name: "Apagar minha conta", exact: true }).click();
        await editor.getByPlaceholder("sua senha", { exact: true }).fill(password);
        await action(editor, "Apagar pra sempre", "/api/account", 409);
        await editor.getByRole("alert").filter({ hasText: /retenção/ }).waitFor();
        await snapshot(editor, "exclusao-bloqueada");
        const text = `Denúncia sintética ${viewport.name} ${stamp}`;
        await goto(admin, "/inspetor/denuncias");
        const adminRow = admin.locator("li").filter({ has: admin.getByText(text, { exact: true }) });
        await adminRow.getByLabel("Justificativa de liberação").fill("Jornada encerrada; retenção revisada");
        const released = admin.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === `/api/admin/reports/${active.reportId}/release-retention`);
        await adminRow.getByRole("button", { name: "Liberar retenção", exact: true }).click();
        assert.equal((await released).status(), 200);
        await adminRow.getByText(/Retenção liberada em/).waitFor();
        await snapshot(admin, "retencao-liberada");
        await sql(`INSERT INTO user_capability_revocations VALUES(${users.inspector.id},'reports.read')`);
        await goto(inspector, "/inspetor/denuncias");
        await inspector.waitForURL(`${WEB}/inspetor`);
        active.checks.push("revogacao-capacidade-pela-interface");
        await sql(`UPDATE users SET role='editor' WHERE id=${users.inspector.id}`);
        await goto(inspector, "/inspetor");
        await inspector.waitForURL(`${WEB}/login`);
        await snapshot(inspector, "revogacao-papel");
        active.database = {
          audit: await sql(`SELECT action,actor_id,details FROM admin_audit WHERE entity='report' AND entity_id='${active.reportId}'`),
          foreignKeys: await sql("PRAGMA foreign_key_check"),
        };
        assert.deepEqual(active.database.foreignKeys, []);
        assert.deepEqual(active.database.audit.map((a) => a.action).sort(), ["denuncia_decidida", "denuncia_encaminhada", "retencao_denuncia_liberada"]);
      });
      active.passed = true;
    } catch (error) {
      active.error = `[${currentStep}] ${String(error).split("\n")[0]}`;
      active.passed = false;
      console.error(`FALHA ${viewport.name} em "${currentStep}": ${active.error}`);
      for (const { context } of contexts.filter((c) => c.viewport === viewport.name)) {
        const [page] = context.pages();
        if (page) await page.screenshot({ path: join(output, `${viewport.name}-FALHA-${page.actor}.png`), fullPage: true }).catch(() => {});
      }
    }
  }
} finally {
  await cleanupUsers();
  const summary = cases.map((c) => ({
    viewport: c.viewport,
    passed: c.passed === true,
    errors: c.findings.filter((f) => f.severity === "error").length,
    warnings: c.findings.filter((f) => f.severity === "warning").length,
    consoleErrors: c.consoleErrors.length,
    serverErrors: c.serverErrors.length,
  }));
  await writeFile(join(output, "resultado.json"), JSON.stringify({ createdAt: new Date().toISOString(), web: WEB, quick, summary, cases }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  for (const { context, actor, viewport } of contexts) {
    await context.tracing.stop({ path: join(output, `${viewport}-${actor}-trace.zip`) }).catch(() => {});
    await context.close().catch(() => {});
  }
  await browser.close();
}
process.exitCode = cases.every((c) => c.passed === true) ? 0 : 1;
