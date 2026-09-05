import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const BASE_URL = "https://oficinaamarela.com.br";
const stamp = Date.now();
const PASSWORD = `SenhaSeguraE2E_${stamp}!`;
const voiceEmail = `voz.e2e.${stamp}@oficinaamarela.com.br`;
const voiceHandle = `voz.e2e.${stamp}`.slice(0, 24);
const editorEmail = `ed.e2e.${stamp}@oficinaamarela.com.br`;
const editorHandle = `ed.e2e.${stamp}`.slice(0, 24);

const toHex = (bytes) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

function generateInvitationToken() {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function hashInvitation(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

const steps = [];
function step(name, passed, detail = "") {
  steps.push({ name, passed, detail });
  console.log(`  ${passed ? "✅ OK " : "❌ FALHA"} ${name}${detail ? ` — ${detail}` : ""}`);
  return passed;
}

async function d1(command, attempt = 0) {
  try {
    const { stdout } = await run("npx", [
      "wrangler",
      "d1",
      "execute",
      "oficina-amarela",
      "--remote",
      "--yes",
      "--json",
      "--config",
      "apps/api/wrangler.jsonc",
      "--env",
      "production",
      "--command",
      command,
    ], {
      maxBuffer: 32 * 1024 * 1024,
      env: {
        ...process.env,
        CLOUDFLARE_ACCOUNT_ID: "53878b12fbc280f03fc30b5875f3522f",
      },
    });
    const start = stdout.indexOf("[");
    return start === -1 ? [] : (JSON.parse(stdout.slice(start))[0]?.results ?? []);
  } catch (error) {
    if (attempt < 3 && /Authentication error|code: 10000|fetch failed/.test(String(error))) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      return d1(command, attempt + 1);
    }
    throw error;
  }
}

async function d1Exec(command) {
  return d1(command);
}

async function call(path, cookie, method = "GET", body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

console.log(`\n======================================================`);
console.log(`🚀 INICIANDO TESTE E2E COMPLETO EM PRODUÇÃO (${BASE_URL})`);
console.log(`🏷️  ID único do teste: ${stamp}`);
console.log(`======================================================\n`);

let missionId = null;
let voiceUserId = null;
let editorUserId = null;

try {
  // -------------------------------------------------------------------
  // 1. Emissão de convite oficial para Porta-Voz no D1
  // -------------------------------------------------------------------
  const rawToken = generateInvitationToken();
  const tokenHash = await hashInvitation(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await d1Exec(
    `INSERT INTO spokesperson_invitations (email, token_hash, created_by, expires_at) VALUES ('${voiceEmail}', '${tokenHash}', 1, '${expiresAt}')`
  );
  step("Emissão de convite oficial para porta-voz no D1", true, `email=${voiceEmail}`);

  // -------------------------------------------------------------------
  // 2. Cadastro oficial do Porta-Voz via API HTTP
  // -------------------------------------------------------------------
  const voiceSignupRes = await call("/api/auth/signup", null, "POST", {
    name: "Porta-Voz E2E Prod",
    handle: voiceHandle,
    email: voiceEmail,
    password: PASSWORD,
    role: "spokesperson",
    invitation: rawToken,
  });
  const voiceSignupBody = await voiceSignupRes.json().catch(() => ({}));
  const voiceCookie = voiceSignupRes.headers.get("set-cookie")?.split(";")[0];
  voiceUserId = voiceSignupBody.id;

  step(
    "Porta-voz resgata convite e completa cadastro via API",
    voiceSignupRes.status === 200 && Boolean(voiceUserId && voiceCookie),
    `status=${voiceSignupRes.status}, id=${voiceUserId}`
  );

  // -------------------------------------------------------------------
  // 3. Cadastro oficial do Editor via API HTTP
  // -------------------------------------------------------------------
  const editorSignupRes = await call("/api/auth/signup", null, "POST", {
    name: "Editor E2E Prod",
    handle: editorHandle,
    email: editorEmail,
    password: PASSWORD,
    role: "editor",
  });
  const editorSignupBody = await editorSignupRes.json().catch(() => ({}));
  const editorCookie = editorSignupRes.headers.get("set-cookie")?.split(";")[0];
  editorUserId = editorSignupBody.id;

  step(
    "Editor completa cadastro via API",
    editorSignupRes.status === 200 && Boolean(editorUserId && editorCookie),
    `status=${editorSignupRes.status}, id=${editorUserId}`
  );

  // -------------------------------------------------------------------
  // 4. Verificação de sessões
  // -------------------------------------------------------------------
  const voiceSessionRes = await call("/api/auth/session", voiceCookie);
  const voiceSession = await voiceSessionRes.json().catch(() => ({}));
  step(
    "Sessão do Porta-Voz autenticada com sucesso",
    voiceSessionRes.status === 200 && (voiceSession.role === "spokesperson" || voiceSession.role === "voz"),
    `role=${voiceSession.role}`
  );

  const editorSessionRes = await call("/api/auth/session", editorCookie);
  const editorSession = await editorSessionRes.json().catch(() => ({}));
  step(
    "Sessão do Editor autenticada com sucesso",
    editorSessionRes.status === 200 && editorSession.role === "editor",
    `role=${editorSession.role}`
  );

  // -------------------------------------------------------------------
  // 5. Porta-Voz cria uma nova missão via API
  // -------------------------------------------------------------------
  const createMissionRes = await call("/api/missions", voiceCookie, "POST", {
    title: `[E2E-AUTO] Pauta Validacao Prod ${stamp}`,
    format: "short",
    tone: "direto",
  });
  const createMissionBody = await createMissionRes.json().catch(() => ({}));
  missionId = createMissionBody.id;

  step(
    "Porta-Voz cria missão via API",
    createMissionRes.status === 201 && Number.isInteger(missionId),
    `id=${missionId}`
  );

  // -------------------------------------------------------------------
  // 6. Colaboração: Porta-Voz envia mensagem no chat da missão
  // -------------------------------------------------------------------
  const msgRes = await call(`/api/missions/db-${missionId}`, voiceCookie, "POST", {
    action: "message",
    text: `Mensagem de validação E2E ${stamp}`,
  });
  step(
    "Porta-Voz publica mensagem no chat da missão",
    msgRes.status === 200,
    `status=${msgRes.status}`
  );

  // Consulta as mensagens da missão
  const readMsgRes = await call(`/api/missions/db-${missionId}`, voiceCookie);
  const readMsgBody = await readMsgRes.json().catch(() => ({}));
  const hasMsg = (readMsgBody.messages ?? []).some((m) => m.text?.includes(String(stamp)));
  step(
    "Consulta de mensagens do chat retorna a mensagem enviada",
    readMsgRes.status === 200 && hasMsg,
    `mensagens=${readMsgBody.messages?.length ?? 0}`
  );

  // -------------------------------------------------------------------
  // 7. Ciclo de Vida: Editor reserva a missão
  // -------------------------------------------------------------------
  const reserveRes = await call(`/api/missions/db-${missionId}`, editorCookie, "POST", {
    action: "reserve",
  });
  step(
    "Editor reserva a missão via API (Durable Object Coordinator)",
    reserveRes.status === 200,
    `status=${reserveRes.status}`
  );

  // -------------------------------------------------------------------
  // 8. Ciclo de Vida: Editor entrega os cortes
  // -------------------------------------------------------------------
  const deliveryLink = `https://pub-451404b3cac349fd9a27c46af9a89b63.r2.dev/teste-entrega-${stamp}.mp4`;
  const deliverRes = await call(`/api/missions/db-${missionId}`, editorCookie, "POST", {
    action: "deliver",
    link: deliveryLink,
  });
  step(
    "Editor entrega os cortes da missão",
    deliverRes.status === 200,
    `status=${deliverRes.status}`
  );

  // -------------------------------------------------------------------
  // 9. Ciclo de Vida: Porta-Voz aprova a entrega
  // -------------------------------------------------------------------
  const approveRes = await call(`/api/missions/db-${missionId}`, voiceCookie, "POST", {
    action: "approve",
    rating: 5,
    feedback: "Corte excelente!",
  });
  step(
    "Porta-Voz aprova a entrega com nota 5",
    approveRes.status === 200,
    `status=${approveRes.status}`
  );

  // -------------------------------------------------------------------
  // 10. Validação de estado e gatilhos no D1
  // -------------------------------------------------------------------
  const [finalMission] = await d1(
    `SELECT id, status, is_scored, reserved_by_id FROM missions WHERE id = ${missionId}`
  );
  step(
    "Missão finalizada e pontuada no D1",
    finalMission?.status === "finalizada" && finalMission?.is_scored === 1 && finalMission?.reserved_by_id === editorUserId,
    `status=${finalMission?.status}, is_scored=${finalMission?.is_scored}`
  );

  const [editorStats] = await d1(
    `SELECT delivered_count, reputation, rating FROM users WHERE id = ${editorUserId}`
  );
  step(
    "Gatilho apply_mission_approval atualizou entregas e reputação do Editor",
    editorStats?.delivered_count === 1 && editorStats?.reputation > 0 && editorStats?.rating === 5,
    `entregas=${editorStats?.delivered_count}, reputacao=${editorStats?.reputation}, nota=${editorStats?.rating}`
  );

  const [invitationRow] = await d1(
    `SELECT used_at, used_by FROM spokesperson_invitations WHERE email = '${voiceEmail}'`
  );
  step(
    "Gatilho apply_invitation_redemption marcou convite como usado",
    Boolean(invitationRow?.used_at) && invitationRow?.used_by === voiceUserId,
    `used_by=${invitationRow?.used_by}`
  );

} catch (err) {
  console.error("❌ ERRO INESPERADO DURANTE A EXECUÇÃO DO TESTE:", err);
} finally {
  // -------------------------------------------------------------------
  // 11. LIMPEZA TOTAL DOS DADOS DE TESTE (CLEANUP GARANTIDO)
  // -------------------------------------------------------------------
  console.log("\n🧹 INICIANDO LIMPEZA DOS DADOS DE TESTE EM PRODUÇÃO...");

  try {
    const cleanupCommands = [];

    if (missionId) {
      cleanupCommands.push(
        `DELETE FROM mensagens WHERE pauta_id = ${missionId}`,
        `DELETE FROM messages WHERE mission_id = ${missionId}`,
        `DELETE FROM ranking_aprovacoes WHERE pauta_id = ${missionId}`,
        `DELETE FROM ranking_approvals WHERE mission_id = ${missionId}`,
        `DELETE FROM mission_approvals WHERE mission_id = ${missionId}`,
        `DELETE FROM avaliacoes WHERE pauta_id = ${missionId}`,
        `DELETE FROM reviews WHERE mission_id = ${missionId}`,
        `DELETE FROM ofertas WHERE pauta_id = ${missionId}`,
        `DELETE FROM offers WHERE mission_id = ${missionId}`,
        `DELETE FROM pautas WHERE id = ${missionId}`,
        `DELETE FROM missions WHERE id = ${missionId}`
      );
    }

    const testUserIds = [voiceUserId, editorUserId].filter(Boolean);
    if (testUserIds.length > 0) {
      const idsList = testUserIds.join(",");
      cleanupCommands.push(
        `DELETE FROM auditoria_admin WHERE ator_id IN (${idsList})`,
        `DELETE FROM admin_audit WHERE actor_id IN (${idsList})`,
        `DELETE FROM gamificacao_eventos WHERE user_id IN (${idsList})`,
        `DELETE FROM gamification_events WHERE user_id IN (${idsList})`,
        `DELETE FROM portfolio WHERE user_id IN (${idsList})`,
        `DELETE FROM conquistas WHERE user_id IN (${idsList})`,
        `DELETE FROM achievements WHERE user_id IN (${idsList})`,
        `DELETE FROM users WHERE id IN (${idsList})`
      );
    }

    cleanupCommands.push(
      `DELETE FROM invitation_redemptions WHERE email = '${voiceEmail}'`,
      `DELETE FROM spokesperson_invitations WHERE email = '${voiceEmail}'`,
      `DELETE FROM tentativas_login WHERE chave LIKE '%${stamp}%'`,
      `DELETE FROM login_attempts WHERE key LIKE '%${stamp}%'`,
      `DELETE FROM users WHERE handle LIKE '%.e2e.${stamp}' OR email LIKE '%.e2e.${stamp}%'`
    );

    for (const cmd of cleanupCommands) {
      try {
        await d1Exec(cmd);
      } catch (e) {
        // ignora se a tabela não possui o registro
      }
    }

    // Validação final de integridade após limpeza
    const remainingUsers = await d1(
      `SELECT count(*) as count FROM users WHERE handle LIKE '%.e2e.${stamp}' OR email LIKE '%.e2e.${stamp}%'`
    );
    const remainingMissions = missionId
      ? await d1(`SELECT count(*) as count FROM missions WHERE id = ${missionId}`)
      : [{ count: 0 }];

    const userClean = Number(remainingUsers[0]?.count ?? 1) === 0;
    const missionClean = Number(remainingMissions[0]?.count ?? 1) === 0;

    step(
      "Todos os usuários de teste removidos do D1 de produção",
      userClean,
      `restantes=${remainingUsers[0]?.count ?? 0}`
    );
    step(
      "Todas as missões de teste removidas do D1 de produção",
      missionClean,
      `restantes=${remainingMissions[0]?.count ?? 0}`
    );

    const [finalUserCount] = await d1("SELECT count(*) as count FROM users");
    console.log(`\n📊 Total de usuários reais em produção após a limpeza: ${finalUserCount?.count}`);

  } catch (cleanErr) {
    console.error("⚠️ Falha na limpeza de produção:", cleanErr);
  }

  const allPassed = steps.every((s) => s.passed);
  console.log(`\n======================================================`);
  console.log(allPassed ? "🎉 TODOS OS PASSOS DO TESTE E2E FORAM APROVADOS COM SUCESSO!" : "⚠️ ALGUNS PASSOS FALHARAM.");
  console.log(`======================================================\n`);
  process.exit(allPassed ? 0 : 1);
}
