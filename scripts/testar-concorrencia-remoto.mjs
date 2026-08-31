// Prova as invariantes de concorrência contra um ambiente Cloudflare publicado.
//
//   API=https://oficina-amarela-api-staging.casamarela.workers.dev \
//   D1=oficina-amarela-staging \
//   node scripts/testar-concorrencia-remoto.mjs
//
// Os testes locais provam o código. Este prova a combinação que só existe no
// ar: D1 de verdade, gatilhos de verdade, Durable Object de verdade e latência
// de rede entre as tentativas.
//
// Só escreve em ambiente de teste: recusa banco cujo nome não termine em
// -staging.

import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const API = process.env.API;
const D1 = process.env.D1;

if (!API || !D1) {
  console.error("Faltam API e D1 no ambiente.");
  process.exit(2);
}
if (!D1.endsWith("-staging")) {
  console.error(`Recusado: ${D1} não parece ambiente de teste.`);
  process.exit(2);
}

const results = [];
function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? "ok  " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
}

// O wrangler devolve "Authentication error [code: 10000]" de vez em quando,
// aparentemente quando o token OAuth renova. Serial e com nova tentativa passa.
async function wrangler(args, attempt = 0) {
  try {
    const { stdout } = await run("npx", ["wrangler", ...args], {
      maxBuffer: 32 * 1024 * 1024,
      env: process.env,
    });
    return stdout;
  } catch (error) {
    const transient = /Authentication error|code: 10000|fetch failed/.test(String(error));
    if (!transient || attempt >= 3) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    return wrangler(args, attempt + 1);
  }
}

async function d1(command) {
  const stdout = await wrangler([
    "d1", "execute", D1, "--remote", "--yes", "--json", "--command", command,
  ]);
  const start = stdout.indexOf("[");
  return start === -1 ? [] : (JSON.parse(stdout.slice(start))[0]?.results ?? []);
}

async function d1Exec(command) {
  await wrangler(["d1", "execute", D1, "--remote", "--yes", "--command", command]);
}

const stamp = Date.now();

// A senha é fixa e o hash é dela. Criar editor por /auth/signup esbarraria no
// limite de cadastros por IP — que é justamente uma das proteções que este
// ambiente precisa manter ligada.
const PASSWORD = "senha-de-concorrencia-123";
const PASSWORD_HASH = "$2b$10$bPQBqSNG9JjINA95BKQSdeFovv59JKw6mDhwFYkeY2Ec7U5fRhpmW";

async function createEditor(index) {
  const handle = `carga.${stamp}.${index}`;
  const [row] = await d1(
    `INSERT INTO users (apelido, nome, email, papel, senha_hash, ultimo_visto_em)
     VALUES ('${handle}', 'Carga ${index}', '${handle}@teste.local', 'editor',
             '${PASSWORD_HASH}', '2099-01-01T00:00:00.000Z')
     RETURNING id`,
  );

  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`login ${index}: ${response.status} ${await response.text()}`);
  return { id: row.id, handle, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

const reserve = (missionId, cookie) =>
  fetch(`${API}/missions/db-${missionId}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ action: "reserve" }),
  });

console.log(`\nConcorrência contra ${API}\n`);

// ---------------------------------------------------------------- preparação
// Serial: o wrangler não gosta de invocação paralela.
const editors = [];
for (const index of [0, 1, 2, 3, 4]) editors.push(await createEditor(index));
const [voice] = await d1(
  `INSERT INTO users (apelido, nome, email, papel) VALUES ('voz.${stamp}', 'Voz Carga', 'voz.${stamp}@teste.local', 'voz') RETURNING id`,
);
const voiceId = voice.id;

async function freshMission() {
  const [row] = await d1(
    `INSERT INTO pautas (porta_voz_id, titulo, formato, status) VALUES (${voiceId}, 'Missão de carga', 'short', 'disponivel') RETURNING id`,
  );
  return row.id;
}

// --------------------------------------------- 1. uma missão, muitos editores
{
  const missionId = await freshMission();
  const responses = await Promise.all(editors.map((editor) => reserve(missionId, editor.cookie)));
  const winners = responses.filter((response) => response.ok).length;
  const [row] = await d1(
    `SELECT status, reservada_por_id FROM pautas WHERE id = ${missionId}`,
  );
  check("uma missão disputada por 5 editores tem exatamente 1 vencedor", winners === 1, `ok=${winners}`);
  check("a missão fica reservada para alguém", row.status === "reservada" && row.reservada_por_id !== null);
}

// ------------------------------------------ 2. um editor, muitas missões
{
  const missions = await Promise.all([0, 1, 2, 3].map(() => freshMission()));
  const editor = editors[1];
  const responses = await Promise.all(missions.map((id) => reserve(id, editor.cookie)));
  const winners = responses.filter((response) => response.ok).length;
  const [row] = await d1(
    `SELECT count(*) AS n FROM pautas WHERE reservada_por_id = ${editor.id} AND status IN ('reservada','em_revisao','reedicao')`,
  );
  check("um editor pedindo 4 missões ao mesmo tempo fica com 1", winners <= 1, `ok=${winners}`);
  check("o banco confirma no máximo uma missão ativa por editor", Number(row.n) <= 1, `ativas=${row.n}`);
}

// ------------------------------------------------ 3. reserva repetida
{
  const missionId = await freshMission();
  const editor = editors[2];
  const responses = await Promise.all([0, 1, 2].map(() => reserve(missionId, editor.cookie)));
  const winners = responses.filter((response) => response.ok).length;
  check("a mesma reserva enviada 3x não duplica", winners <= 1, `ok=${winners}`);
}

// ------------------------------------------- 4. resgate de convite concorrente
{
  const token = `t${stamp}`;
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const email = `convidada.${stamp}@teste.local`;
  const [admin] = await d1(
    `INSERT INTO users (apelido, nome, email, papel) VALUES ('adm.${stamp}', 'Adm', 'adm.${stamp}@teste.local', 'admin') RETURNING id`,
  );
  await d1Exec(
    `INSERT INTO convites_porta_voz (email, token_hash, criado_por, expira_em) VALUES ('${email}', '${hash}', ${admin.id}, '2099-01-01T00:00:00.000Z')`,
  );

  const redeem = (index) =>
    fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Convidada",
        handle: `convidada.${stamp}.${index}`,
        email,
        password: "senha-de-concorrencia-123",
        role: "spokesperson",
        invitation: token,
      }),
    });

  // O resgate precisa passar pelo cadastro de verdade; limpa o limitador de IP
  // para o teste medir a corrida, e não a proteção contra enxurrada.
  await d1Exec("DELETE FROM tentativas_login");
  const responses = await Promise.all([0, 1, 2].map(redeem));
  const winners = responses.filter((response) => response.ok).length;
  const [row] = await d1(
    `SELECT count(*) AS n FROM users WHERE email = '${email}' AND papel = 'voz'`,
  );
  check("três resgates simultâneos do mesmo convite: 1 vence", winners === 1, `ok=${winners}`);
  check("o convite gera exatamente uma conta oficial", Number(row.n) === 1, `contas=${row.n}`);
}

// --------------------------------------------------------------- 5. limpeza
//
// Ordem de dependência primeiro; falha aqui não pode esconder o resultado dos
// testes, então o relatório sai antes.
const failed = results.filter((entry) => !entry.passed);
console.log(
  `\n${results.length - failed.length}/${results.length} invariantes mantidas em ambiente publicado.`,
);

const TEST_ACCOUNTS =
  "SELECT id FROM users WHERE apelido LIKE 'carga.%' OR apelido LIKE 'voz.%'" +
  " OR apelido LIKE 'adm.%' OR apelido LIKE 'convidada.%'";

try {
  for (const command of [
    `DELETE FROM auditoria_admin WHERE ator_id IN (${TEST_ACCOUNTS})`,
    `DELETE FROM gamificacao_eventos WHERE user_id IN (${TEST_ACCOUNTS})`,
    `DELETE FROM invitation_redemptions WHERE email LIKE 'convidada.%'`,
    `DELETE FROM convites_porta_voz WHERE criado_por IN (${TEST_ACCOUNTS}) OR email LIKE 'convidada.%'`,
    `DELETE FROM mensagens WHERE autor_id IN (${TEST_ACCOUNTS})`,
    `DELETE FROM avaliacoes WHERE editor_id IN (${TEST_ACCOUNTS})`,
    `DELETE FROM denuncias WHERE denunciante_id IN (${TEST_ACCOUNTS}) OR denunciado_id IN (${TEST_ACCOUNTS})`,
    `DELETE FROM ofertas WHERE editor_id IN (${TEST_ACCOUNTS}) OR pauta_id IN (SELECT id FROM pautas WHERE porta_voz_id IN (${TEST_ACCOUNTS}))`,
    `DELETE FROM pautas WHERE porta_voz_id IN (${TEST_ACCOUNTS}) OR reservada_por_id IN (${TEST_ACCOUNTS})`,
    `DELETE FROM tentativas_login`,
    `DELETE FROM users WHERE id IN (${TEST_ACCOUNTS})`,
  ]) {
    await d1Exec(command);
  }
  console.log("Ambiente de teste limpo.");
} catch (error) {
  console.log(`Limpeza incompleta (não invalida o resultado): ${String(error).slice(0, 120)}`);
}

process.exit(failed.length === 0 ? 0 : 1);
