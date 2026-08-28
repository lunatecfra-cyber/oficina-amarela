export const DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN || "";

export const SENTRY_OPTIONS = {
  dsn: DSN,
  enabled: !!DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
};
