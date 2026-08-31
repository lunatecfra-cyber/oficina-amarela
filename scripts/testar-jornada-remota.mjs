// Jornada completa contra um ambiente Cloudflare publicado.
//
//   API=https://oficina-amarela-api-staging.casamarela.workers.dev \
//   D1=oficina-amarela-staging \
//   node scripts/testar-jornada-remota.mjs
//
// Os testes de unidade provam cada peça. Este prova que o produto funciona:
// convite oficial, cadastro, missão, oferta, entrega, revisão, aprovação, e os
// contadores mexendo no fim. Só escreve em ambiente de teste.

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

const PASSWORD = "senha-de-concorrencia-123";
const HASH = "$2b$10$bPQBqSNG9JjINA95BKQSdeFovv59JKw6mDhwFYkeY2Ec7U5fRhpmW";
const stamp = Date.now();

const steps = [];
function step(name, passed, detail = "") {
  steps.push({ name, passed, detail });
  console.log(`  ${passed ? "ok   " : "FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
  return passed;
}

async function wrangler(args, attempt = 0) {
  try {
    const { stdout } = await run("npx", ["wrangler", ...args], {
      maxBuffer: 32 * 1024 * 1024,
      env: process.env,
    });
    return stdout;
  } catch (error) {
    if (attempt >= 3 || !/Authentication error|code: 10000|fetch failed/.test(String(error)))
      throw error;
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    return wrangler(args, attempt + 1);
  }
}

const d1 = async (command) => {
  const stdout = await wrangler([
    "d1",
    "execute",
    D1,
    "--remote",
    "--yes",
    "--json",
    "--command",
    command,
  ]);
  const start = stdout.indexOf("[");
  return start === -1 ? [] : (JSON.parse(stdout.slice(start))[0]?.results ?? []);
};
const d1Exec = (command) =>
  wrangler(["d1", "execute", D1, "--remote", "--yes", "--command", command]);

async function login(handle) {
  const response = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle, password: PASSWORD }),
  });
  if (!response.ok) throw new Error(`login ${handle}: ${response.status} ${await response.text()}`);
  return response.headers.get("set-cookie")?.split(";")[0];
}

const call = (path, cookie, method = "GET", body) =>
  fetch(`${API}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

console.log(`\nJornada completa contra ${API}\n`);
await d1Exec("DELETE FROM tentativas_login");

// ------------------------------------------------------- 1. inspetor e editor
const [admin] = await d1(
  `INSERT INTO users (apelido,nome,email,papel,senha_hash) VALUES ('adm.j${stamp}','Inspetor','adm.j${stamp}@teste.local','admin','${HASH}') RETURNING id`,
);
const [editor] = await d1(
  `INSERT INTO users (apelido,nome,email,papel,senha_hash,ultimo_visto_em,perfil_completo) VALUES ('ed.j${stamp}','Editor Jornada','ed.j${stamp}@teste.local','editor','${HASH}','2099-01-01T00:00:00.000Z',1) RETURNING id`,
);
const adminCookie = await login(`adm.j${stamp}`);
const editorCookie = await login(`ed.j${stamp}`);
step("inspetor e editor entram", Boolean(adminCookie && editorCookie));

// ------------------------------------------------ 2. convite oficial emitido
const voiceEmail = `voz.j${stamp}@teste.local`;
const invitationResponse = await call("/admin/invitations", adminCookie, "POST", {
  email: voiceEmail,
});
const invitationBody = await invitationResponse.json().catch(() => ({}));
const token = invitationBody.token ?? invitationBody.convite ?? invitationBody.invitation;
step(
  "inspetor emite convite de porta-voz",
  invitationResponse.ok && Boolean(token),
  `status=${invitationResponse.status}`,
);

// -------------------------------------------- 3. porta-voz resgata e entra
const signupResponse = await call("/auth/signup", null, "POST", {
  name: "Voz Jornada",
  handle: `voz.j${stamp}`,
  email: voiceEmail,
  password: PASSWORD,
  role: "spokesperson",
  invitation: token,
});
step(
  "porta-voz resgata o convite e vira conta oficial",
  signupResponse.ok,
  `status=${signupResponse.status}`,
);
const voiceCookie =
  signupResponse.headers.get("set-cookie")?.split(";")[0] ?? (await login(`voz.j${stamp}`));

const [voiceRow] = await d1(`SELECT papel FROM users WHERE email = '${voiceEmail}'`);
step("a conta nasce com papel de porta-voz", voiceRow?.papel === "voz", `papel=${voiceRow?.papel}`);

// A fila oferece a UM editor elegível, escolhido por histórico. Para a jornada
// medir o fluxo e não a disputa, o editor dela precisa ser o único elegível:
// todo outro editor sai da janela de presença.
await d1Exec(
  `UPDATE users SET ultimo_visto_em = '2000-01-01T00:00:00.000Z' WHERE papel = 'editor' AND id <> ${editor.id}`,
);

// --------------------------------------------------------- 4. missão criada
const missionResponse = await call("/missions", voiceCookie, "POST", {
  title: "Reel de campanha",
  format: "short",
  tone: "direto",
});
const missionBody = await missionResponse.json().catch(() => ({}));
const missionId = Number(String(missionBody.id ?? "").replace(/^db-/, ""));
step("porta-voz cria missão", missionResponse.ok && Number.isInteger(missionId), `id=${missionId}`);

// ----------------------------------------------- 5. oferta chega e é aceita
// O despacho é assíncrono: a criação publica na fila e o consumidor executa.
// Espera curta em vez de assumir instantâneo.
let offerResponse = await call("/editor/queue/next", editorCookie);
for (let attempt = 0; attempt < 20 && offerResponse.status !== 200; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  offerResponse = await call("/editor/queue/next", editorCookie);
}
step(
  "a missão é oferecida ao editor",
  offerResponse.status === 200,
  `status=${offerResponse.status}`,
);

const acceptResponse = await call("/editor/queue/next", editorCookie, "POST", {
  missionId,
  action: "accept",
});
step("editor aceita a oferta", acceptResponse.ok, `status=${acceptResponse.status}`);

const [afterAccept] = await d1(
  `SELECT status, reservada_por_id FROM pautas WHERE id = ${missionId}`,
);
step(
  "a missão fica com o editor",
  afterAccept?.status === "reservada" && afterAccept?.reservada_por_id === editor.id,
);

// --------------------------------------------------------------- 6. conversa
const messageResponse = await call(`/missions/db-${missionId}`, editorCookie, "POST", {
  action: "message",
  text: "Comecei a edição.",
});
const readResponse = await call(`/missions/db-${missionId}`, voiceCookie);
const readBody = await readResponse.json().catch(() => ({}));
step(
  "editor manda mensagem e porta-voz lê",
  messageResponse.ok && (readBody.messages?.length ?? 0) >= 1,
);

// ------------------------------------------------- 7. entrega, revisão, nova
const deliverResponse = await call(`/missions/db-${missionId}`, editorCookie, "POST", {
  action: "deliver",
  link: "https://exemplo.local/entrega-1",
});
step("editor entrega", deliverResponse.ok, `status=${deliverResponse.status}`);

const reviseResponse = await call(`/missions/db-${missionId}`, adminCookie, "POST", {
  action: "re_edit",
  notes: "Ajustar o corte final.",
});
step("inspetor pede reedição", reviseResponse.ok, `status=${reviseResponse.status}`);

const redeliverResponse = await call(`/missions/db-${missionId}`, editorCookie, "POST", {
  action: "deliver",
  link: "https://exemplo.local/entrega-2",
});
step("editor entrega de novo", redeliverResponse.ok, `status=${redeliverResponse.status}`);

// ------------------------------------------------------------ 8. aprovação
const [before] = await d1(`SELECT entregues, reputacao FROM users WHERE id = ${editor.id}`);
const approveResponse = await call(`/missions/db-${missionId}`, voiceCookie, "POST", {
  action: "approve",
  rating: 5,
});
step("porta-voz aprova", approveResponse.ok, `status=${approveResponse.status}`);

const [after] = await d1(`SELECT entregues, reputacao FROM users WHERE id = ${editor.id}`);
step(
  "aprovação move entregas e reputação",
  Number(after?.entregues) > Number(before?.entregues) &&
    Number(after?.reputacao) > Number(before?.reputacao),
  `entregues ${before?.entregues}->${after?.entregues} reputacao ${before?.reputacao}->${after?.reputacao}`,
);

const [scored] = await d1(
  `SELECT count(*) AS n FROM ranking_aprovacoes WHERE pauta_id = ${missionId} AND anulado_em IS NULL`,
);
step("a aprovação pontua no ranking eleitoral", Number(scored?.n) === 1, `linhas=${scored?.n}`);

// ------------------------------------------- 9. aprovação repetida é idempotente
const again = await call(`/missions/db-${missionId}`, voiceCookie, "POST", {
  action: "approve",
  rating: 5,
});
const [afterAgain] = await d1(`SELECT entregues FROM users WHERE id = ${editor.id}`);
step(
  "aprovar de novo não pontua duas vezes",
  Number(afterAgain?.entregues) === Number(after?.entregues),
  `entregues=${afterAgain?.entregues} status=${again.status}`,
);

// -------------------------------------------------------------- 10. limpeza
const report = `${steps.filter((entry) => entry.passed).length}/${steps.length}`;
console.log(`\n${report} passos da jornada completos em ambiente publicado.`);

const ACCOUNTS = `SELECT id FROM users WHERE apelido LIKE '%.j${stamp}'`;
try {
  for (const command of [
    `DELETE FROM auditoria_admin WHERE ator_id IN (${ACCOUNTS})`,
    `DELETE FROM gamificacao_eventos WHERE user_id IN (${ACCOUNTS})`,
    `DELETE FROM ranking_aprovacoes WHERE pauta_id IN (SELECT id FROM pautas WHERE porta_voz_id IN (${ACCOUNTS}))`,
    `DELETE FROM mission_approvals WHERE pauta_id IN (SELECT id FROM pautas WHERE porta_voz_id IN (${ACCOUNTS}))`,
    `DELETE FROM invitation_redemptions WHERE email LIKE 'voz.j${stamp}%'`,
    `DELETE FROM convites_porta_voz WHERE email LIKE 'voz.j${stamp}%'`,
    `DELETE FROM avaliacoes WHERE editor_id IN (${ACCOUNTS})`,
    `DELETE FROM mensagens WHERE autor_id IN (${ACCOUNTS})`,
    `DELETE FROM ofertas WHERE editor_id IN (${ACCOUNTS})`,
    `DELETE FROM pautas WHERE porta_voz_id IN (${ACCOUNTS}) OR reservada_por_id IN (${ACCOUNTS})`,
    `DELETE FROM users WHERE id IN (${ACCOUNTS})`,
  ]) {
    await d1Exec(command);
  }
  console.log("Ambiente de teste limpo.");
} catch (error) {
  console.log(`Limpeza incompleta: ${String(error).slice(0, 120)}`);
}

process.exit(steps.every((entry) => entry.passed) ? 0 : 1);
