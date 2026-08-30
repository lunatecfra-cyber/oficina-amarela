import assert from "node:assert/strict";
import { after, before, beforeEach, describe, test } from "node:test";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.AUTH_SECRET ??= "segredo-de-teste-com-tamanho-suficiente";
}

describe("autenticação na API", {
  skip: TEST_DATABASE_URL ? false : "TEST_DATABASE_URL não configurado",
}, async () => {
  const { sql } = await import("@oficina/db/client");
  const { COOKIE_NAME } = await import("@oficina/auth/session");
  const { hashPassword } = await import("../account-registration.ts");
  const { createApp } = await import("../app.ts");
  const { postgresApiDependencies } = await import("../dependencies.ts");

  let sentRecoveries: string[] = [];
  const app = createApp({
    ...postgresApiDependencies,
    sendRecoveryEmail: async (_id, email) => {
      sentRecoveries.push(email);
    },
  });

  const MARK = "%@auth.local";
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(`http://api.local/auth/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

  async function cleanup() {
    await sql`DELETE FROM tentativas_login`;
    await sql`DELETE FROM users WHERE email LIKE ${MARK}`;
  }

  before(async () => {
    await cleanup();
    const hash = await hashPassword("senha-correta");
    await sql`
        INSERT INTO users (apelido, nome, email, senha_hash, papel)
        VALUES ('editor.auth', 'Editor Auth', 'editor@auth.local', ${hash}, 'editor')
      `;
  });

  beforeEach(() => {
    sentRecoveries = [];
  });

  after(async () => {
    await cleanup();
    await sql.end();
  });

  test("login correto devolve sessão em cookie httpOnly", async () => {
    const response = await post("login", { handle: "editor.auth", password: "senha-correta" });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, new RegExp(`^${COOKIE_NAME}=`));
    assert.match(cookie, /HttpOnly/i);
    const body = (await response.json()) as { role: string; handle: string };
    assert.equal(body.role, "editor");
    assert.equal(body.handle, "editor.auth");
  });

  test("senha errada não distingue de apelido inexistente", async () => {
    const wrongPassword = await post("login", { handle: "editor.auth", password: "errada" });
    const noSuchUser = await post("login", { handle: "nao.existe", password: "errada" });

    assert.equal(wrongPassword.status, 401);
    assert.equal(noSuchUser.status, 401);
    assert.deepEqual(await wrongPassword.json(), await noSuchUser.json());
  });

  test("tentativas repetidas trancam a conta e devolvem 429", async () => {
    await sql`DELETE FROM tentativas_login`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await post("login", { handle: "editor.auth", password: "errada" });
    }
    const locked = await post("login", { handle: "editor.auth", password: "senha-correta" });
    assert.equal(locked.status, 429, "a senha certa não pode destravar a conta trancada");
    assert.match(((await locked.json()) as { error: string }).error, /Muitas tentativas/);
    await sql`DELETE FROM tentativas_login`;
  });

  test("login bem-sucedido zera o contador de tentativas", async () => {
    await sql`DELETE FROM tentativas_login`;
    await post("login", { handle: "editor.auth", password: "errada" });
    await post("login", { handle: "editor.auth", password: "senha-correta" });
    const [row] = await sql`
        SELECT chave FROM tentativas_login WHERE chave = 'login:editor.auth'
      `;
    assert.equal(row, undefined);
  });

  test("conta banida não entra mesmo com a senha certa", async () => {
    await sql`UPDATE users SET banido = true WHERE email = 'editor@auth.local'`;
    const response = await post("login", { handle: "editor.auth", password: "senha-correta" });
    assert.equal(response.status, 401);
    assert.match(((await response.json()) as { error: string }).error, /suspensa/);
    await sql`UPDATE users SET banido = false WHERE email = 'editor@auth.local'`;
    await sql`DELETE FROM tentativas_login`;
  });

  test("cadastro de editor cria conta e já devolve sessão", async () => {
    const response = await post("signup", {
      name: "Nova Editora",
      handle: "nova.editora",
      email: "nova@auth.local",
      password: "senha-nova",
      role: "editor",
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`^${COOKIE_NAME}=`));
    const [row] = await sql`SELECT papel FROM users WHERE email = 'nova@auth.local'`;
    assert.equal(row.papel, "editor");
  });

  test("cadastro não concede papel que não se pede para si", async () => {
    const response = await post("signup", {
      name: "Falso Admin",
      handle: "falso.admin",
      email: "falso@auth.local",
      password: "senha-nova",
      role: "admin",
    });
    // 'admin' não é um papel escolhível: a rota recusa antes de criar.
    assert.equal(response.status, 400);
    const [row] = await sql`SELECT id FROM users WHERE email = 'falso@auth.local'`;
    assert.equal(row, undefined);
  });

  test("porta-voz sem convite não vira conta oficial", async () => {
    const response = await post("signup", {
      name: "Candidato",
      handle: "candidato.auth",
      email: "candidato@auth.local",
      password: "senha-nova",
      role: "spokesperson",
    });
    assert.equal(response.status, 400);
    assert.match(
      ((await response.json()) as { error: string }).error,
      /Convite especial obrigatório/,
    );
    const [row] = await sql`SELECT id FROM users WHERE email = 'candidato@auth.local'`;
    assert.equal(row, undefined);
  });

  test("recuperação responde igual para e-mail conhecido e desconhecido", async () => {
    const known = await post("recover", { email: "editor@auth.local" });
    const unknown = await post("recover", { email: "ninguem@auth.local" });

    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.deepEqual(await known.json(), await unknown.json());
    assert.deepEqual(sentRecoveries, ["editor@auth.local"], "só a conta real recebe e-mail");
    await sql`DELETE FROM tentativas_login`;
  });

  test("sessão exige cookie válido e o logout apaga o cookie", async () => {
    const anonymous = await app.request("http://api.local/auth/session");
    assert.equal(anonymous.status, 401);

    const login = await post("login", { handle: "editor.auth", password: "senha-correta" });
    const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
    const session = await app.request("http://api.local/auth/session", { headers: { cookie } });
    assert.equal(session.status, 200);
    assert.equal(((await session.json()) as { handle: string }).handle, "editor.auth");

    const logout = await post("logout", {});
    assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0|Expires=/i);
  });

  test("redefinir senha invalida o link usado", async () => {
    const { createRecoveryToken } = await import("@oficina/auth/session");
    const [user] = await sql`SELECT id FROM users WHERE email = 'editor@auth.local'`;
    const token = await createRecoveryToken(Number(user.id));

    const first = await post("reset-password", { token, password: "senha-trocada" });
    assert.equal(first.status, 200);

    const replay = await post("reset-password", { token, password: "outra-senha" });
    assert.equal(replay.status, 401, "o mesmo link não pode servir duas vezes");

    // Restaura para os outros casos que dependem da senha original.
    const hash = await hashPassword("senha-correta");
    await sql`UPDATE users SET senha_hash = ${hash} WHERE id = ${user.id}`;
  });
});
