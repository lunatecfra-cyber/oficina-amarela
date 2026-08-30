import {
  COOKIE_NAME,
  COOKIE_OPTS,
  createSessionToken,
  verifyRecoveryToken,
} from "@oficina/auth/session";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
  DUMMY_HASH,
  hashPassword,
  registerAccount,
  verifyPassword,
} from "../account-registration.ts";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { readSession } from "../session.ts";

/**
 * Autenticação.
 *
 * O limite de tentativas mora no banco, não em memória: com vários isolates um
 * contador por processo não limita nada. Ele conta por apelido e por IP, porque
 * as duas formas de abuso são diferentes — insistir numa conta e varrer muitas.
 *
 * A resposta de recuperação de senha é sempre a mesma, exista a conta ou não:
 * o contrário transformaria o formulário num verificador de e-mails cadastrados.
 */

const MAX_LOGIN_ATTEMPTS = 5;
const MAX_LOGINS_PER_IP = 30;
const MAX_SIGNUPS_PER_IP = 5;
const MAX_RECOVERIES_PER_EMAIL = 3;
const MAX_RECOVERIES_PER_IP = 15;
const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 15;

const RECOVERY_REPLY = {
  ok: true,
  message: "Se existir uma conta com esse e-mail, o link de recuperação foi enviado.",
};

type AuthEnv = { Bindings: Bindings; Variables: { requestId: string } };

function clientIp(headers: Headers): string {
  const forwarded = headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "local";
}

export function createAuthRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<AuthEnv>();
  const accounts = dependencies.accounts;

  routes.get("/session", async (c) => {
    const session = await readSession(c);
    if (!session) return c.json(null, 401);
    return c.json(session);
  });

  routes.post("/logout", (c) => {
    deleteCookie(c, COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  });

  routes.post("/login", async (c) => {
    const body = await c.req.json().catch(() => null);
    const handle = body?.handle ?? body?.apelido;
    const password = body?.password ?? body?.senha;
    if (typeof handle !== "string" || typeof password !== "string") {
      return c.json({ error: "Digite seu apelido e senha." }, 400);
    }

    const ip = clientIp(c.req.raw.headers);
    const [byHandle, byIp] = await Promise.all([
      accounts.isRateLocked(`login:${handle}`),
      accounts.isRateLocked(`loginip:${ip}`),
    ]);
    if (byHandle.locked || byIp.locked) {
      const minutes = Math.max(byHandle.minutes, byIp.minutes);
      return c.json({ error: `Muitas tentativas. Tente novamente em ${minutes} min.` }, 429);
    }

    const account = await accounts.findByHandle(handle);
    // Compara sempre, mesmo sem conta: o tempo de resposta não pode revelar
    // quais apelidos existem.
    const matches = await verifyPassword(password, account?.passwordHash ?? DUMMY_HASH);

    if (!account?.passwordHash || !matches) {
      await Promise.all([
        accounts.recordAttempt(`login:${handle}`, MAX_LOGIN_ATTEMPTS, WINDOW_MINUTES, LOCK_MINUTES),
        accounts.recordAttempt(`loginip:${ip}`, MAX_LOGINS_PER_IP, WINDOW_MINUTES, LOCK_MINUTES),
      ]);
      return c.json({ error: "Apelido ou senha incorretos." }, 401);
    }
    if (account.banned) {
      return c.json({ error: "Conta suspensa. Fale com a fiscalização." }, 401);
    }

    await accounts.clearAttempts(`login:${handle}`);

    const identity = {
      id: account.id,
      handle: account.handle,
      name: account.name,
      role: account.role,
    };
    setCookie(c, COOKIE_NAME, await createSessionToken(identity), COOKIE_OPTS);
    await dependencies
      .recordGamificationEvent(account.id, "daily_login", new Date().toISOString().slice(0, 10))
      .catch((error) =>
        console.error(JSON.stringify({ event: "gamification-failed", error: String(error) })),
      );

    return c.json({ ok: true, ...identity, email: account.email });
  });

  routes.post("/signup", async (c) => {
    const body = await c.req.json().catch(() => null);
    const ip = clientIp(c.req.raw.headers);
    const ipKey = `signup:${ip}`;

    const locked = await accounts.isRateLocked(ipKey);
    if (locked.locked) {
      return c.json(
        { error: `Muitas contas criadas deste endereço. Tente em ${locked.minutes} min.` },
        429,
      );
    }

    const rawRole = body?.role ?? body?.papel;
    if (rawRole !== "spokesperson" && rawRole !== "voz" && rawRole !== "editor") {
      return c.json({ error: "Escolha se você é candidato ou editor." }, 400);
    }

    const result = await registerAccount(
      accounts,
      dependencies.invitationRedemption,
      {
        name: body?.name ?? body?.nome,
        handle: body?.handle ?? body?.apelido,
        email: body?.email,
        password: body?.password ?? body?.senha,
        role: rawRole,
        invitation: body?.invitation ?? body?.convite ?? null,
        referralCode: body?.referralCode ?? body?.codigoIndicacao ?? null,
      },
      { requirePassword: true },
    );

    await accounts.recordAttempt(ipKey, MAX_SIGNUPS_PER_IP, WINDOW_MINUTES, LOCK_MINUTES);
    if (!result.ok) return c.json({ error: result.error }, result.status);

    setCookie(c, COOKIE_NAME, await createSessionToken(result.account), COOKIE_OPTS);
    await dependencies
      .recordGamificationEvent(
        result.account.id,
        "daily_login",
        new Date().toISOString().slice(0, 10),
      )
      .catch(() => {});

    return c.json({ ok: true, ...result.account });
  });

  routes.post("/recover", async (c) => {
    const body = await c.req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) return c.json({ error: "Digite um e-mail válido." }, 400);

    const ip = clientIp(c.req.raw.headers);
    const [lockEmail, lockIp] = await Promise.all([
      accounts.isRateLocked(`recover:${email}`),
      accounts.isRateLocked(`recover-ip:${ip}`),
    ]);
    // Mesmo trancado a resposta é a mesma: quem sonda não descobre nada.
    if (lockEmail.locked || lockIp.locked) return c.json(RECOVERY_REPLY);

    await Promise.all([
      accounts.recordAttempt(
        `recover:${email}`,
        MAX_RECOVERIES_PER_EMAIL,
        WINDOW_MINUTES,
        LOCK_MINUTES,
      ),
      accounts.recordAttempt(
        `recover-ip:${ip}`,
        MAX_RECOVERIES_PER_IP,
        WINDOW_MINUTES,
        LOCK_MINUTES,
      ),
    ]);

    const account = await accounts.findByEmail(email);
    if (account) await dependencies.sendRecoveryEmail(account.id, account.email, account.name);

    return c.json(RECOVERY_REPLY);
  });

  routes.post("/reset-password", async (c) => {
    const body = await c.req.json().catch(() => null);
    const token = body?.token;
    const password = body?.password ?? body?.senha;
    if (typeof token !== "string" || typeof password !== "string") {
      return c.json({ error: "Preencha a nova senha." }, 400);
    }
    if (password.length < 6) {
      return c.json({ error: "Senha precisa de pelo menos 6 caracteres." }, 400);
    }

    const data = await verifyRecoveryToken(token);
    if (!data) return c.json({ error: "Link inválido ou expirado. Peça outro." }, 401);

    // O corte de sessão avança a cada troca de senha, então um link antigo —
    // emitido antes da última troca — já não vale. É o que impede reusar o link.
    const cutoffMs = await accounts.sessionCutoffMs(data.userId);
    if (cutoffMs !== null && data.issuedAtMs < cutoffMs) {
      return c.json({ error: "Link expirado ou já utilizado. Peça outro." }, 401);
    }

    await accounts.updatePassword(data.userId, await hashPassword(password));
    dependencies.invalidateSessionRevocation(data.userId);
    return c.json({ ok: true });
  });

  return routes;
}
