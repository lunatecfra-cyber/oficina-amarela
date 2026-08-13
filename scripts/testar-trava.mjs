// Prova que a trava de concorrência do dispatch existe no banco.
//
// É o teste que mais importa ao trocar de provedor de Postgres: os índices
// únicos PARCIAIS (`WHERE status = 'pendente'`) são o que impede dois
// editores receberem a mesma missão. Se o índice não vier na migração, nada
// falha visivelmente — o bug só aparece com dois editores online ao mesmo
// tempo, e aí já é tarde.
//
// Uso: DATABASE_URL="..." node scripts/testar-trava.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não configurado");

const sql = postgres(url, { prepare: false });
const ok = (b) => (b ? "OK" : "FALHOU");
let tudoOk = true;

try {
  const [dono] = await sql`SELECT id FROM users LIMIT 1`;
  if (!dono) throw new Error("banco sem nenhum usuário — crie um antes");

  const [e1] = await sql`
    INSERT INTO users (apelido, nome, email, papel)
    VALUES ('__trava1', 'Trava 1', '__trava1@teste.local', 'editor') RETURNING id`;
  const [e2] = await sql`
    INSERT INTO users (apelido, nome, email, papel)
    VALUES ('__trava2', 'Trava 2', '__trava2@teste.local', 'editor') RETURNING id`;
  const [pa] = await sql`
    INSERT INTO pautas (porta_voz_id, titulo, formato)
    VALUES (${dono.id}, '__trava A', 'short') RETURNING id`;
  const [pb] = await sql`
    INSERT INTO pautas (porta_voz_id, titulo, formato)
    VALUES (${dono.id}, '__trava B', 'short') RETURNING id`;

  const ofertar = (pautaId, editorId, ordem) => sql`
    INSERT INTO ofertas (pauta_id, editor_id, expira_em, ordem)
    VALUES (${pautaId}, ${editorId}, now() + interval '5 minutes', ${ordem})`;

  const barrou = async (fn) => {
    try {
      await fn();
      return null;
    } catch (e) {
      return e.code;
    }
  };

  await ofertar(pa.id, e1.id, 1);
  console.log("1a oferta criada");

  const a = await barrou(() => ofertar(pa.id, e2.id, 2));
  console.log(`A) mesma missão pra outro editor -> ${ok(a === "23505")} (${a ?? "passou!"})`);
  tudoOk &&= a === "23505";

  const b = await barrou(() => ofertar(pb.id, e1.id, 1));
  console.log(`B) outra missão pro mesmo editor -> ${ok(b === "23505")} (${b ?? "passou!"})`);
  tudoOk &&= b === "23505";

  // depois de respondida, a linha sai do índice parcial e a missão pode ser
  // oferecida de novo — é assim que a rodada avança
  await sql`UPDATE ofertas SET status = 'rejeitada' WHERE pauta_id = ${pa.id}`;
  const c = await barrou(() => ofertar(pa.id, e2.id, 2));
  console.log(`C) reofertar após recusa -> ${ok(c === null)} (${c ?? "passou, correto"})`);
  tudoOk &&= c === null;

  await sql`DELETE FROM pautas WHERE titulo LIKE '__trava %'`;
  await sql`DELETE FROM users WHERE apelido IN ('__trava1', '__trava2')`;

  const [u] = await sql`SELECT count(*)::int c FROM users`;
  const [p] = await sql`SELECT count(*)::int c FROM pautas`;
  const [o] = await sql`SELECT count(*)::int c FROM ofertas`;
  console.log(`\nlimpo. restou -> users: ${u.c} | pautas: ${p.c} | ofertas: ${o.c}`);
  console.log(tudoOk ? "\nTRAVA FUNCIONANDO" : "\nTRAVA COM PROBLEMA");
} finally {
  await sql.end();
}

process.exit(tudoOk ? 0 : 1);
