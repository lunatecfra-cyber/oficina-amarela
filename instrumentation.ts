import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { OPCOES_SENTRY } from "@/lib/sentry-comum";

// Roda uma vez quando o servidor sobe. Só inicializa no runtime Node — o
// middleware (proxy.ts) roda em Edge e não precisa disso.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(OPCOES_SENTRY);
  }
}

/**
 * Gancho do Next pra todo erro que o servidor captura.
 *
 * É o que faltava: o projeto tinha 2 `console.error` no total e 19 blocos
 * `catch` quase todos mudos — uma falha em produção era invisível.
 *
 * O `digest` é a ponte: `app/error.tsx` mostra esse mesmo código na tela, e
 * em produção a mensagem real do erro nunca chega ao cliente. Com ele no
 * evento, o código que a pessoa relata acha o erro exato no Sentry.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context
) => {
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined;

  Sentry.captureException(err, {
    tags: { digest, rota: request.path },
    extra: { context },
  });

  // sem DSN o capture acima não faz nada, então o log continua sendo a
  // única visibilidade em desenvolvimento
  console.error("[erro]", request.path, digest ?? "", err);
};
