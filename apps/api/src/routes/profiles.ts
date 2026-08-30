import {
  COOKIE_NAME,
  COOKIE_OPTS,
  createSessionToken,
  type UserSession,
} from "@oficina/auth/session";
import bcrypt from "bcryptjs";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireEditor, requireSession, requireSpokesperson } from "../session.ts";

type ProfileEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

export function createProfileRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<ProfileEnv>();

  routes.get("/profile", requireSession, async (c) => {
    const session = c.get("session");
    const profile = await dependencies.profiles.readEditableProfile(session.id);
    if (!profile)
      return c.json({ error: "Perfil não encontrado.", erro: "Perfil não encontrado." }, 404);
    return c.json(profile);
  });

  routes.post("/profile", requireSession, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await dependencies.profiles.saveEditableProfile(session.id, body);
    if (!result.ok) {
      return c.json({ error: result.error, erro: result.error }, 400);
    }
    return c.json({ ok: true });
  });

  routes.get("/editor/profile", requireEditor, async (c) => {
    const session = c.get("session");
    const onboarding = await dependencies.profiles.readEditorOnboarding(session.id);
    return c.json(onboarding ?? null);
  });

  routes.get("/editor/challenges", requireEditor, async (c) => {
    const session = c.get("session");
    const challenges = await dependencies.gamification.listDailyChallenges(session.id);
    return c.json(challenges);
  });

  routes.post("/editor/daily-login", requireEditor, async (c) => {
    const session = c.get("session");
    const result = await dependencies.gamification.recordDailyLogin(session.id);
    return c.json(result);
  });

  routes.post("/editor/profile", requireEditor, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await dependencies.profiles.saveEditorOnboarding(session.id, body);
    if (!result.ok) {
      return c.json({ error: result.error, erro: result.error }, 400);
    }
    return c.json({ ok: true });
  });

  routes.post("/editor/schedule", requireEditor, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const grid = (body.schedule ?? body.disponibilidade) as boolean[][];
    const result = await dependencies.profiles.saveEditorSchedule(session.id, grid);
    if (!result.ok) {
      return c.json({ error: result.error, erro: result.error }, 400);
    }
    return c.json({ ok: true });
  });

  routes.get("/editor/profile/:handleOrId", async (c) => {
    const handleOrId = c.req.param("handleOrId");
    const isNum = /^\d+$/.test(handleOrId);
    const profile = await dependencies.profiles.readEditorProfile(
      isNum ? Number(handleOrId) : handleOrId,
    );
    if (!profile)
      return c.json({ error: "Editor não encontrado.", erro: "Editor não encontrado." }, 404);
    return c.json(profile);
  });

  routes.get("/editor/ranking", requireSession, async (c) => {
    const limitParam = c.req.query("limit");
    const limit = limitParam ? Math.min(100, Math.max(1, Number(limitParam) || 10)) : 10;
    const ranking = await dependencies.profiles.readEditorRanking(limit);
    return c.json(ranking);
  });

  routes.get("/spokesperson/profile", requireSpokesperson, async (c) => {
    const session = c.get("session");
    const onboarding = await dependencies.profiles.readCandidateOnboarding(session.id);
    return c.json(onboarding ?? null);
  });

  routes.post("/spokesperson/profile", requireSpokesperson, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await dependencies.profiles.saveCandidateOnboarding(session.id, body);
    if (!result.ok) {
      return c.json({ error: result.error, erro: result.error }, 400);
    }
    return c.json({ ok: true });
  });

  routes.get("/spokesperson/own", requireSpokesperson, async (c) => {
    const session = c.get("session");
    const own = await dependencies.profiles.readOwnCandidate(session.id);
    if (!own)
      return c.json({ error: "Candidato não encontrado.", erro: "Candidato não encontrado." }, 404);
    return c.json(own);
  });

  routes.get("/candidates/:slug", async (c) => {
    const slug = c.req.param("slug");
    const candidate = await dependencies.profiles.readPublicCandidate(slug);
    if (!candidate)
      return c.json({ error: "Candidato não encontrado.", erro: "Candidato não encontrado." }, 404);
    return c.json(candidate);
  });

  routes.post("/candidates/by-handles", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const handles = Array.isArray(body.handles)
      ? body.handles.filter((x): x is string => typeof x === "string")
      : [];
    const map = await dependencies.profiles.readCandidatesByHandles(handles);
    const obj: Record<string, unknown> = {};
    for (const [key, value] of map) {
      obj[key] = value;
    }
    return c.json(obj);
  });

  routes.delete("/account", requireSession, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const confirmation = String(body?.confirmation ?? body?.confirmacao ?? "");

    if (!confirmation || confirmation.trim().toLowerCase() !== session.handle.toLowerCase()) {
      return c.json(
        {
          error: "Confirme o apelido da conta antes de apagar.",
          erro: "Confirme o apelido da conta antes de apagar.",
        },
        400,
      );
    }

    await dependencies.accounts.deleteAccount(session.id);
    dependencies.invalidateSessionRevocation(session.id);
    deleteCookie(c, COOKIE_NAME, { path: "/" });
    return c.json({ ok: true });
  });

  routes.post("/account/password", requireSession, async (c) => {
    const session = c.get("session");
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const newPassword = body?.newPassword ?? body?.novaSenha;

    if (typeof newPassword !== "string" || !newPassword.trim()) {
      return c.json({ error: "Digite a nova senha.", erro: "Digite a nova senha." }, 400);
    }
    if (newPassword.length > 200) {
      return c.json({ error: "Senha longa demais.", erro: "Senha longa demais." }, 400);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await dependencies.accounts.updatePassword(session.id, hash);
    dependencies.invalidateSessionRevocation(session.id);

    const refreshedSession: UserSession = {
      ...session,
      issuedAt: Math.floor(Date.now() / 1000),
      emitidoEm: Math.floor(Date.now() / 1000),
    };
    const token = await createSessionToken(refreshedSession);
    setCookie(c, COOKIE_NAME, token, {
      httpOnly: COOKIE_OPTS.httpOnly,
      secure: COOKIE_OPTS.secure,
      sameSite: COOKIE_OPTS.sameSite,
      path: COOKIE_OPTS.path,
      maxAge: COOKIE_OPTS.maxAge,
    });

    return c.json({ ok: true });
  });

  routes.get("/account", requireSession, async (c) => {
    const session = c.get("session");
    const acc = await dependencies.accounts.findByHandle(session.handle);
    const hasPassword = Boolean(acc?.passwordHash);
    return c.json({
      hasPassword,
      temSenha: hasPassword,
      account: acc
        ? {
            id: acc.id,
            handle: acc.handle,
            name: acc.name,
            email: acc.email,
            role: acc.role,
          }
        : null,
    });
  });

  return routes;
}
