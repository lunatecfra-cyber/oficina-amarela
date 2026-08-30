import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("ERRO: DATABASE_URL não encontrada no .env.local");
  process.exit(1);
}

const sql = postgres(databaseUrl, { ssl: "require" });

async function testConnection() {
  try {
    console.log("Conectando ao banco Neon/Postgres...");
    const [usuarios] = await sql`SELECT count(*) as total FROM usuarios`;
    const [pautas] = await sql`SELECT count(*) as total FROM pautas`;
    const [entregas] = await sql`SELECT count(*) as total FROM entregas`;

    console.log("-----------------------------------------");
    console.log("✅ CONEXÃO COM O BANCO BEM-SUCEDIDA!");
    console.log("-----------------------------------------");
    console.log(`👤 Total de Usuários cadastrados: ${usuarios.total}`);
    console.log(`📋 Total de Missões (Pautas):     ${pautas.total}`);
    console.log(`🎬 Total de Entregas realizadas:  ${entregas.total}`);
    console.log("-----------------------------------------");
    process.exit(0);
  } catch (err) {
    console.error("❌ Falha na conexão com o banco:", err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

testConnection();
