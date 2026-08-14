// Cria contas aleatórias pra teste do inspetor. Roda uma vez e apaga depois.
//   node --env-file=.env.local scripts/seed-teste.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const suf = Math.random().toString(36).slice(2, 6);

const contas = [
  {
    apelido: `editor.teste.${suf}`,
    nome: "Marina Costa",
    email: `marina.${suf}@exemplo.com`,
    papel: "editor",
    extra: {
      entregues: 7,
      reputacao: 175,
      streak: 3,
      perfil_completo: true,
      localizacao: "Recife, PE",
      bio: "Edito short de política desde 2024.",
      softwares: ["CapCut", "Premiere"],
      estilos: ["Ritmo rápido", "Cortes impactantes"],
    },
  },
  {
    apelido: `candidato.teste.${suf}`,
    nome: "Rafael Bezerra",
    email: `rafael.${suf}@exemplo.com`,
    papel: "voz",
    extra: {
      perfil_completo: true,
      localizacao: "Fortaleza, CE",
      cargo: "Vereador",
      disputa_por: "Câmara Municipal de Fortaleza",
      ano_eleicao: "2026",
      bio: "Candidato a vereador, foco em cultura periferia.",
    },
  },
];

for (const c of contas) {
  const cols = ["apelido", "nome", "email", "papel", ...Object.keys(c.extra)];
  const vals = [c.apelido, c.nome, c.email, c.papel, ...Object.values(c.extra)];
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const [linha] = await sql.unsafe(
    `INSERT INTO users (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING id, apelido, papel`,
    vals
  );
  console.log(`✓ criado: @${linha.apelido} (${linha.papel}) — id ${linha.id}`);
}

await sql.end();
console.log("pronto.");
