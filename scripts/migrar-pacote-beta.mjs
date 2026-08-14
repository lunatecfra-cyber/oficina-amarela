// Migração do PACOTE BETA: chat por missão + denúncias + fim do prazo de reserva.
//   node --env-file=.env.local scripts/migrar-pacote-beta.mjs          (dev)
//   node --env-file=<prod> scripts/migrar-pacote-beta.mjs              (produção, ANTES do deploy — regra do AGENTS.md)
// Idempotente — pode rodar quantas vezes quiser.
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

console.log("Pacote beta — parte 1: tabelas de chat e denúncias...");

await sql`
  CREATE TABLE IF NOT EXISTS mensagens (
    id SERIAL PRIMARY KEY,
    pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
    autor_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
console.log("  ✓ mensagens");
await sql`CREATE INDEX IF NOT EXISTS idx_mensagens_pauta ON mensagens (pauta_id)`;
console.log("  ✓ índice mensagens.pauta_id");

await sql`
  CREATE TABLE IF NOT EXISTS denuncias (
    id SERIAL PRIMARY KEY,
    pauta_id INT NOT NULL REFERENCES pautas(id) ON DELETE CASCADE,
    denunciante_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    denunciado_id INT REFERENCES users(id) ON DELETE SET NULL,
    texto TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta'
      CHECK (status IN ('aberta','resolvida','ignorada')),
    criada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolvida_em TIMESTAMPTZ
  )`;
console.log("  ✓ denuncias");
await sql`CREATE INDEX IF NOT EXISTS idx_denuncias_status ON denuncias (status)`;
console.log("  ✓ índice denuncias.status");

const check = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('mensagens','denuncias')`;
console.log("Confirmação — tabelas presentes:", check.map((r) => r.table_name));

console.log("Pacote beta — parte 2: fim do prazo de reserva...");

// quando a missão foi reservada (a agenda usava reservada_ate - 24h pra
// derivar isso; agora vira coluna de verdade)
await sql`ALTER TABLE pautas ADD COLUMN IF NOT EXISTS reservada_em TIMESTAMPTZ`;
console.log("  ✓ pautas.reservada_em");

// backfill: missões que ainda têm prazo ganham início derivado dele
const backfill = await sql`
  UPDATE pautas SET reservada_em = reservada_ate - interval '24 hours'
  WHERE reservada_em IS NULL AND reservada_ate IS NOT NULL
  RETURNING id`;
console.log(`  ✓ backfill do início: ${backfill.length} missão(ões)`);

// o prazo morre: nenhuma tela mostra mais "prazo vencido" de missão presa
const limpas = await sql`
  UPDATE pautas SET reservada_ate = NULL WHERE reservada_ate IS NOT NULL
  RETURNING id`;
console.log(`  ✓ prazos limpos: ${limpas.length} missão(ões)`);

await sql.end();
console.log("pronto.");
