import type { UserSession } from "@oficina/auth/session";
import {
  generateInvitationToken,
  hashInvitation,
  INVITATION_VALIDITY_DAYS,
  normalizeInvitationEmail,
} from "@oficina/domain/invitations";
import { EDITING_STYLES } from "@oficina/domain/profile";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { requireAdmin } from "../session.ts";

/**
 * Administração dos convites de porta-voz.
 *
 * O convite é o portão de legitimidade da conta oficial, então a autorização
 * é explícita aqui na fronteira — nada de RLS nem de checagem na interface. O
 * token em claro só aparece nesta resposta; o banco guarda apenas o hash.
 */

type AdminEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

export function createAdminInvitationRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<AdminEnv>();
  routes.use("*", requireAdmin);

  routes.get("/", async (c) => {
    const invitations = await dependencies.invitationAdmin.listInvitations();
    return c.json({ invitations, convites: invitations });
  });

  routes.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const session = c.get("session");
    const action = body?.action ?? body?.acao;

    if (action === "revoke" || action === "revogar") {
      const id = Number(body?.id);
      if (!Number.isInteger(id)) return c.json({ error: "Convite inválido." }, 400);
      const revoked = await dependencies.invitationAdmin.revokeInvitation(id, session.id);
      if (!revoked.ok) {
        return c.json({ error: "Convite não está disponível para revogação." }, 409);
      }
      return c.json({ ok: true });
    }

    const email = normalizeInvitationEmail(body?.email);
    if (!email) return c.json({ error: "Digite um e-mail válido." }, 400);
    const kind = body?.kind ?? "spokesperson";
    if (!["spokesperson", "experienced_editor"].includes(kind))
      return c.json({ error: "Escolha o tipo de convite." }, 400);
    if (kind === "experienced_editor" && !c.env.DB)
      return c.json({ error: "Convite de editor indisponível neste ambiente." }, 503);
    const specialties = body?.specialties ?? [];
    if (
      !Array.isArray(specialties) ||
      specialties.length > 3 ||
      specialties.some(
        (value: unknown) =>
          typeof value !== "string" || !EDITING_STYLES.some((style) => style === value),
      )
    )
      return c.json({ error: "Escolha até três especialidades disponíveis no formulário." }, 400);

    const token = generateInvitationToken();
    const issued = await dependencies.invitationAdmin.issueInvitation({
      kind,
      specialties: specialties.map((value: string) => value.trim()),
      email,
      tokenHash: await hashInvitation(token),
      adminId: session.id,
      validityDays: INVITATION_VALIDITY_DAYS,
    });
    if (!issued.ok) {
      if (issued.reason === "issue_failed") {
        return c.json({ error: "Não foi possível gerar o convite. Tente de novo." }, 500);
      }
      return c.json({ error: "Outro convite para este e-mail acabou de sair. Recarregue." }, 409);
    }

    const origin = c.env.PUBLIC_ORIGIN ?? new URL(c.req.url).origin;
    return c.json({
      ok: true,
      id: issued.id,
      email: issued.email,
      token,
      expiresAt: issued.expiresAt,
      link: `${origin}/criar-conta?convite=${encodeURIComponent(token)}${kind === "experienced_editor" ? "&kind=experienced_editor" : ""}`,
    });
  });

  return routes;
}
