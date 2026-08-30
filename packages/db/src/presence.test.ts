// queue.markEditorActive() só grava quando a presença passou da janela. Sem isso, cada
// poll de editor vira uma escrita — a mais frequente do caminho quente.
//
//   TEST_DATABASE_URL="postgres://..." npm test

import assert from "node:assert/strict";
import test, { after, before, describe } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado";

describe("presença do editor", { skip }, async () => {
  const { sql } = await import("./client.ts");
  const { postgresMissionQueue: queue } = await import("./mission-queue.ts");

  before(async () => {
    await sql`SET client_min_messages TO warning`;
  });

  after(async () => {
    await sql`DELETE FROM users WHERE email = 'presenca@teste.local'`;
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
    await queue.markEditorActive(editor.id);
    assert.equal(await seenAt(), before, "poll dentro da janela não pode gerar escrita");

    await sql`
      UPDATE users SET ultimo_visto_em = now() - interval '61 seconds' WHERE id = ${editor.id}
    `;
    const stale = await seenAt();
    await queue.markEditorActive(editor.id);
    assert.ok((await seenAt()) > stale, "passada a janela, o poll precisa renovar a presença");

    await sql`DELETE FROM users WHERE id = ${editor.id}`;
  });
});
