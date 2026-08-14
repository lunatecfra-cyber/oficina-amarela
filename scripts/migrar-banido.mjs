// Roda a migração das colunas de banimento direto no banco.
//   node --env-file=.env.local scripts/migrar-banido.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });

console.log("Aplicando migração de banimento...");
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banido BOOLEAN NOT NULL DEFAULT false`;
console.log("  ✓ banido");
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS banido_em TIMESTAMPTZ`;
console.log("  ✓ banido_em");
await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS motivo_banimento TEXT`;
console.log("  ✓ motivo_banimento");

const check = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('banido','banido_em','motivo_banimento') ORDER BY column_name`;
console.log("Confirmação — colunas presentes:", check.map((r) => r.column_name));

await sql.end();
console.log("pronto.");
