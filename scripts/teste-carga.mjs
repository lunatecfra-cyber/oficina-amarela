/**
 * Teste de carga progressivo contra um ambiente já implantado.
 *
 * Não aponta para produção por padrão nem por acidente: a base é obrigatória.
 * O alvo esperado é o staging.
 *
 *   node scripts/teste-carga.mjs --base https://staging.exemplo --usuarios 100
 *   node scripts/teste-carga.mjs --base http://localhost:8790 --estagios 100,500,1000
 *   node scripts/teste-carga.mjs --base ... --cenario reserva --banco "postgres://..."
 *
 * Dois modos, porque medem coisas diferentes:
 *
 *   mix     — mistura realista de tráfego. Mede latência, erro e 429.
 *   reserva — rajada de reserva da mesma missão. Não mede latência: mede se a
 *             invariante aguentou. Uma violação aqui reprova o cenário inteiro,
 *             por mais bonita que esteja a latência.
 */

import { fork } from "node:child_process";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const baseUrl = option("base");
const scenario = option("cenario", "mix");
const stages = String(option("estagios", "100,500,1000,2500,5000"))
  .split(",")
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value > 0);
const seconds = Number(option("segundos", "30"));
/**
 * Quantos processos geram a carga.
 *
 * Um processo só de Node não sustenta muito mais que ~200 conexões simultâneas:
 * a partir daí o que se mede é a fila do gerador, não o servidor. O sinal é
 * claro — a vazão CAI enquanto o p50 continua baixo e o p95 explode, e o Worker
 * não registra erro nenhum. Foi exatamente o que apareceu em 500 usuários.
 */
const processes = Math.max(1, Number(option("processos", String(Math.min(8, os.cpus().length)))));
const shardUsers = Number(option("__fatia", "0"));
const databaseUrl = option("banco") ?? process.env.TEST_DATABASE_URL;

if (!baseUrl) {
  console.error(
    "Uso: --base <url do ambiente> [--cenario mix|reserva] [--estagios 100,500]\n" +
      "     [--segundos 30] [--banco <postgres://...> para conferir invariantes]\n" +
      "A base é obrigatória de propósito: nada aqui aponta para produção sozinho.",
  );
  process.exit(2);
}

/**
 * Mistura de tráfego. Os pesos vêm do plano de carga: a maior parte do tempo os
 * usuários estão navegando, não disparando a operação mais cara.
 */
const TRAFFIC_MIX = [
  { weight: 65, name: "navegação", method: "GET", path: "/" },
  { weight: 18, name: "fila do editor", method: "GET", path: "/api/editor/queue/next" },
  { weight: 8, name: "ranking", method: "GET", path: "/api/ranking" },
  { weight: 5, name: "vagas", method: "GET", path: "/api/slots" },
  { weight: 4, name: "sessão", method: "GET", path: "/api/auth/session" },
];

function pick() {
  const total = TRAFFIC_MIX.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of TRAFFIC_MIX) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return TRAFFIC_MIX[0];
}

function percentile(sorted, fraction) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index];
}

async function runStage(users) {
  const latencies = [];
  const statuses = new Map();
  const deadline = Date.now() + seconds * 1000;
  let serverErrors = 0;
  let clientFailures = 0;

  async function worker() {
    while (Date.now() < deadline) {
      const route = pick();
      const startedAt = performance.now();
      try {
        const response = await fetch(new URL(route.path, baseUrl), {
          method: route.method,
          headers: { "user-agent": "oficina-teste-carga" },
          redirect: "manual",
        });
        latencies.push(performance.now() - startedAt);
        statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
        if (response.status >= 500) serverErrors += 1;
      } catch {
        // Conexão recusada, reset, timeout: falha do gerador ou do caminho de
        // rede, não do servidor. Contar como erro de servidor faz perseguir
        // fantasma — foi o que aconteceu quando o Worker registrava zero
        // exceção e o relatório acusava 5% de erro.
        latencies.push(performance.now() - startedAt);
        clientFailures += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: users }, () => worker()));

  const sorted = latencies.sort((a, b) => a - b);
  const total = latencies.length;
  return {
    users,
    total,
    rawLatencies: sorted,
    rawErrors: serverErrors,
    rawClientFailures: clientFailures,
    rps: Math.round(total / seconds),
    p50: Math.round(percentile(sorted, 0.5)),
    p95: Math.round(percentile(sorted, 0.95)),
    p99: Math.round(percentile(sorted, 0.99)),
    errorRate: total ? serverErrors / total : 0,
    clientFailureRate: total ? clientFailures / total : 0,
    rateLimited: statuses.get(429) ?? 0,
    statuses: [...statuses.entries()].sort((a, b) => b[1] - a[1]),
  };
}

/** Limiares do docs/CLOUDFLARE_LOAD_TEST_PLAN.md §2. */
const THRESHOLDS = { p50: 200, p95: 800, p99: 2000, errorRate: 0.001 };

function verdict(result) {
  const failures = [];
  if (result.p50 > THRESHOLDS.p50) failures.push(`p50 ${result.p50}ms > ${THRESHOLDS.p50}ms`);
  if (result.p95 > THRESHOLDS.p95) failures.push(`p95 ${result.p95}ms > ${THRESHOLDS.p95}ms`);
  if (result.p99 > THRESHOLDS.p99) failures.push(`p99 ${result.p99}ms > ${THRESHOLDS.p99}ms`);
  if (result.errorRate > THRESHOLDS.errorRate) {
    failures.push(`erro ${(result.errorRate * 100).toFixed(2)}% > 0.1%`);
  }
  return failures;
}

/**
 * Rajada de reserva: a mesma missão disputada por muitos editores ao mesmo
 * tempo. Aqui não interessa latência — interessa se sobrou exatamente um dono.
 * A conferência é por consulta ao banco, não pela resposta da API, porque é
 * justamente a resposta que já mentiu antes (P0-02).
 */
async function runClaimBurst(users) {
  if (!databaseUrl) {
    console.error("O cenário 'reserva' precisa de --banco para conferir as invariantes.");
    process.exit(2);
  }
  const { default: postgres } = await import("postgres");
  const sql = postgres(databaseUrl, { prepare: false });

  try {
    const open = await sql`
      SELECT id FROM pautas WHERE status = 'aberta' ORDER BY id LIMIT 1
    `;
    if (open.length === 0) {
      console.error("Nenhuma pauta aberta no ambiente: semeie antes de disputar.");
      process.exit(2);
    }
    const missionId = Number(open[0].id);
    console.log(`Disputando a pauta ${missionId} com ${users} editores simultâneos.\n`);

    const responses = await Promise.all(
      Array.from({ length: users }, () =>
        fetch(new URL("/api/editor/queue/next", baseUrl), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ missionId, action: "accept" }),
        })
          .then((response) => response.status)
          .catch(() => 0),
      ),
    );
    const accepted = responses.filter((status) => status === 200).length;

    const [owners] = await sql`
      SELECT count(*)::int AS total FROM pautas
      WHERE id = ${missionId} AND reservada_por_id IS NOT NULL
    `;
    const doubled = await sql`
      SELECT reservada_por_id, count(*)::int AS total FROM pautas
      WHERE reservada_por_id IS NOT NULL
        AND status IN ('reservada', 'em_edicao', 'em_revisao', 'reedicao')
      GROUP BY reservada_por_id HAVING count(*) > 1
    `;

    console.log(`respostas 200            : ${accepted}`);
    console.log(`donos da pauta no banco  : ${owners.total}`);
    console.log(`editores com 2+ missões  : ${doubled.length}`);

    const violations = [];
    if (owners.total > 1) violations.push("a mesma pauta ficou com mais de um dono");
    if (doubled.length > 0) violations.push("algum editor ficou com mais de uma missão ativa");
    if (accepted > 1) violations.push(`${accepted} editores receberam ok:true para a mesma pauta`);

    if (violations.length === 0) {
      console.log("\nInvariantes preservadas.");
      return true;
    }
    console.log("\nVIOLAÇÃO:");
    for (const violation of violations) console.log(`  - ${violation}`);
    return false;
  } finally {
    await sql.end();
  }
}

// Processo filho: roda a própria fatia e devolve as medições cruas.
if (shardUsers > 0) {
  const result = await runStage(shardUsers);
  // process.send é assíncrono: sair antes do callback descarta a mensagem e o
  // pai fica sem a fatia.
  await new Promise((resolve) => {
    process.send?.(
      {
        latencies: result.rawLatencies,
        errors: result.rawErrors,
        clientFailures: result.rawClientFailures,
        total: result.total,
      },
      () => resolve(),
    );
  });
  process.exit(0);
}

/** Distribui os usuários entre processos e junta as medições. */
async function runShardedStage(users) {
  if (processes === 1 || users <= 100) return runStage(users);

  const here = fileURLToPath(import.meta.url);
  const perShard = Math.ceil(users / processes);
  const shards = [];
  for (let remaining = users; remaining > 0; remaining -= perShard) {
    shards.push(Math.min(perShard, remaining));
  }

  const collected = await Promise.all(
    shards.map(
      (count) =>
        new Promise((resolve, reject) => {
          const child = fork(
            here,
            ["--base", baseUrl, "--segundos", String(seconds), "--__fatia", String(count)],
            { stdio: ["ignore", "ignore", "inherit", "ipc"] },
          );
          let payload = null;
          child.on("message", (message) => {
            payload = message;
          });
          child.on("exit", () =>
            payload ? resolve(payload) : reject(new Error("fatia sem resposta")),
          );
          child.on("error", reject);
        }),
    ),
  );

  const latencies = collected.flatMap((entry) => entry.latencies).sort((a, b) => a - b);
  const errors = collected.reduce((sum, entry) => sum + entry.errors, 0);
  const clientFailures = collected.reduce((sum, entry) => sum + (entry.clientFailures ?? 0), 0);
  const total = collected.reduce((sum, entry) => sum + entry.total, 0);

  return {
    users,
    total,
    rps: Math.round(total / seconds),
    p50: Math.round(percentile(latencies, 0.5)),
    p95: Math.round(percentile(latencies, 0.95)),
    p99: Math.round(percentile(latencies, 0.99)),
    errorRate: total ? errors / total : 0,
    clientFailureRate: total ? clientFailures / total : 0,
    rateLimited: 0,
    statuses: [],
  };
}

console.log(`alvo   : ${baseUrl}`);
console.log(`cenário: ${scenario}`);
console.log(`geração: ${processes} processo(s)\n`);

let failed = false;

if (scenario === "reserva") {
  for (const users of stages) {
    if (!(await runClaimBurst(users))) failed = true;
  }
} else {
  for (const users of stages) {
    const result = await runShardedStage(users);
    const failures = verdict(result);
    console.log(
      `${String(users).padStart(5)} usuários  ${String(result.rps).padStart(6)} req/s  ` +
        `p50 ${String(result.p50).padStart(5)}ms  p95 ${String(result.p95).padStart(5)}ms  ` +
        `p99 ${String(result.p99).padStart(6)}ms  ` +
        `erro-servidor ${(result.errorRate * 100).toFixed(2)}%  ` +
        `falha-cliente ${((result.clientFailureRate ?? 0) * 100).toFixed(2)}%  ` +
        `429 ${result.rateLimited}`,
    );
    if ((result.clientFailureRate ?? 0) > 0.01) {
      console.log(
        "        aviso: falha de cliente alta. Confira o tail do Worker antes de" +
          " culpar o servidor — pode ser o gerador saturando.",
      );
    }
    if (failures.length > 0) {
      failed = true;
      for (const failure of failures) console.log(`        REPROVOU: ${failure}`);
      // Subir a carga depois de reprovar só produz números piores e sem uso.
      console.log("        parando aqui: o próximo estágio não diria nada novo.\n");
      break;
    }
  }
}

process.exit(failed ? 1 : 0);
