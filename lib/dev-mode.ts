/**
 * Portões explícitos para comportamento que só pode existir fora de produção.
 *
 * Antes, atalhos de desenvolvimento — inclusive sessão de admin fabricada —
 * dependiam de `NODE_ENV === "development" && !process.env.VERCEL`. A segunda
 * metade só significava alguma coisa dentro da Vercel; ao sair dela o portão
 * ficava valendo apenas o NODE_ENV, que é definido pelo build, não pela
 * plataforma. Um build sem NODE_ENV abriria tudo.
 *
 * Agora cada atalho exige duas condições, e falha fechado:
 *   1. NODE_ENV diferente de "production" — bloqueio duro, sem exceção;
 *   2. a variável de ambiente correspondente valendo exatamente "1".
 *
 * Nada aqui olha para provedor de hospedagem.
 */

/** Sessões falsas, god mode e /api/auth/dev-login. */
export const DEV_AUTH_BYPASS_ENV = "ALLOW_DEV_AUTH_BYPASS";

/** Missões e perfis de exemplo renderizados sem vir do banco. */
export const DEMO_CONTENT_ENV = "ALLOW_DEMO_CONTENT";

function isEnabled(name: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env[name] === "1";
}

/**
 * Libera os atalhos de autenticação locais. Desligado por padrão: rodar
 * `next dev` sem ALLOW_DEV_AUTH_BYPASS=1 exige login de verdade.
 */
export function isDevAuthBypassEnabled(): boolean {
  return isEnabled(DEV_AUTH_BYPASS_ENV);
}

/** Libera conteúdo de exemplo em telas públicas. Desligado por padrão. */
export function isDemoContentEnabled(): boolean {
  return isEnabled(DEMO_CONTENT_ENV);
}
