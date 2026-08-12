// Configuração compartilhada entre servidor e navegador.
//
// Sem SENTRY_DSN o SDK não manda nada — fica inerte. Isso é de propósito:
// desenvolvimento não polui o projeto do Sentry, e a aplicação sobe igual em
// qualquer ambiente sem a chave.
export const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";

export const OPCOES_SENTRY = {
  dsn: DSN,
  enabled: !!DSN,
  // amostragem baixa: o que interessa aqui é erro, não perfil de performance
  tracesSampleRate: 0.1,
  // não mandar corpo de requisição nem cookie: passam senha, token de
  // recuperação e o data URL da foto
  sendDefaultPii: false,
};
