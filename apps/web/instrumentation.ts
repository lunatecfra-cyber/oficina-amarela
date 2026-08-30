import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { registerApiBindingFromWorkerEnv } from "@/lib/internal-api";
import { SENTRY_OPTIONS } from "@/lib/sentry-common";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(SENTRY_OPTIONS);
  }

  // Fecha a fronteira web → API. Com o Service Binding no ar a chamada vai de
  // Worker para Worker, sem sair para a internet; sem ele, segue em processo.
  const transport = await registerApiBindingFromWorkerEnv();
  console.log(JSON.stringify({ event: "api-transport", transport }));
}

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest)
      : undefined;

  Sentry.captureException(err, {
    tags: { digest, route: request.path },
    extra: { context },
  });

  console.error("[error]", request.path, digest ?? "", err);
};
