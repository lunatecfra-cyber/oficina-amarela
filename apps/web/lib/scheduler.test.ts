// A trava de periodicidade é o que impede a varredura global de rodar uma vez
// por poll de cada editor. Precisa de PostgreSQL real: a garantia está no
// UPSERT condicional, não no código.
//
//   TEST_DATABASE_URL="postgres://..." npm test

import assert from "node:assert/strict";
import test, { after, before, beforeEach, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("trava de periodicidade", { skip }, async () => {
  const { sql } = await import("@/lib/db");
  const { claimPeriodicTask } = await import("@/lib/scheduler-db");
  const { markEditorActive } = await import("@/lib/queue-db");

  const TASK = "teste_varredura";

  before(async () => {
    await sql`SET client_min_messages TO warning`;
    // Sem conexões abertas o driver serializa e a corrida nunca acontece.
    await Promise.all(Array.from({ length: 4 }, () => sql`SELECT 1`));
  });

  beforeEach(async () => {
    await sql`DELETE FROM tarefas_periodicas WHERE nome = ${TASK}`;
  });

  after(async () => {
    await sql`DELETE FROM tarefas_periodicas WHERE nome = ${TASK}`;
    await sql.end();
  });

  test("a primeira chamada ganha e a seguinte não", async () => {
    assert.equal(await claimPeriodicTask(TASK, 60), true);
    assert.equal(await claimPeriodicTask(TASK, 60), false);
  });

  test("só uma entre várias chamadas simultâneas ganha", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => claimPeriodicTask(TASK, 60)));
    assert.equal(results.filter(Boolean).length, 1);
  });

  test("passada a janela, ganha de novo", async () => {
    assert.equal(await claimPeriodicTask(TASK, 60), true);
    await sql`
      UPDATE tarefas_periodicas SET executada_em = now() - interval '61 seconds'
      WHERE nome = ${TASK}
    `;
    assert.equal(await claimPeriodicTask(TASK, 60), true);
  });

  test("presença não regrava dentro da janela", async () => {
    const [editor] = await sql`
      INSERT INTO users (apelido, nome, email, papel, ultimo_visto_em)
      VALUES ('presenca.teste', 'Presença', 'presenca@teste.local', 'editor', now())
      ON CONFLICT (lower(apelido)) DO UPDATE SET ultimo_visto_em = now()
      RETURNING id
    `;

    const seenAt = async () => {
      const [row] = await sql`SELECT ultimo_visto_em FROM users WHERE id = ${editor.id}`;
      return new Date(row.ultimo_visto_em).getTime();
    };

    const before = await seenAt();
    await markEditorActive(editor.id);
    assert.equal(await seenAt(), before, "poll dentro da janela não pode gerar escrita");

    await sql`
      UPDATE users SET ultimo_visto_em = now() - interval '61 seconds' WHERE id = ${editor.id}
    `;
    const stale = await seenAt();
    await markEditorActive(editor.id);
    assert.ok((await seenAt()) > stale, "passada a janela, o poll precisa renovar a presença");

    await sql`DELETE FROM users WHERE id = ${editor.id}`;
  });
});
