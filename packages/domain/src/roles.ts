/**
 * Papel do usuário no produto.
 *
 * Mora aqui, e não em auth, porque quase toda regra de negócio decide alguma
 * coisa por papel — quem pode reservar, quem pode aprovar, qual cabeçalho a
 * página mostra. A sessão apenas transporta o valor.
 */
export type Role = "spokesperson" | "editor" | "inspector" | "admin";

export function roleHome(role: Role) {
  return role === "admin"
    ? "/inspetor"
    : role === "inspector"
      ? "/inspetor"
      : role === "editor"
        ? "/editor"
        : "/porta-voz";
}

/** Alias legado. Sai quando nenhum call site depender dele. */
export type Papel = Role;
