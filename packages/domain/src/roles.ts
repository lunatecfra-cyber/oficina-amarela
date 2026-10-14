/**
 * Papel do usuário no produto.
 *
 * Mora aqui, e não em auth, porque quase toda regra de negócio decide alguma
 * coisa por papel — quem pode reservar, quem pode aprovar, qual cabeçalho a
 * página mostra. A sessão apenas transporta o valor.
 */
export type Role = "spokesperson" | "editor" | "inspector" | "admin";

export const ADMIN_CAPABILITIES = [
  "mission.participate",
  "mission.read",
  "mission.chat",
  "mission.inspect",
  "mission.delete",
  "reports.read",
  "reports.forward",
  "reports.decide",
  "users.manage",
  "invitations.manage",
  "ranking.manage",
  "content.manage",
  "queue.manage",
  "broadcast.send",
  "security.read",
  "portfolio.moderate",
  "disputes.read",
  "disputes.decide",
] as const;
export type Capability =
  | (typeof ADMIN_CAPABILITIES)[number]
  | "reports.releaseRetention"
  | "disputes.mediate";

export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  editor: [],
  spokesperson: [],
  inspector: [
    "mission.read",
    "mission.chat",
    "mission.inspect",
    "reports.read",
    "reports.forward",
    "disputes.read",
  ],
  admin: ADMIN_CAPABILITIES,
};

export function hasCapability(
  actor: { role: Role; capabilities?: readonly string[] },
  capability: Capability,
) {
  return (actor.capabilities ?? ROLE_CAPABILITIES[actor.role]).includes(capability);
}

/** Alias legado. Sai quando nenhum call site depender dele. */
export type Papel = Role;

export function roleHome(role: Role) {
  return role === "admin" || role === "inspector"
    ? "/inspetor"
    : role === "editor"
      ? "/editor"
      : "/porta-voz";
}
