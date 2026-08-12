import * as Sentry from "@sentry/nextjs";
import { OPCOES_SENTRY } from "@/lib/sentry-comum";

// Erro que acontece no navegador (clique que quebra, fetch que falha).
// Inerte sem NEXT_PUBLIC_SENTRY_DSN.
Sentry.init(OPCOES_SENTRY);

// exigido pelo Next pra medir navegação no cliente
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
