import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";
import { SENTRY_OPTIONS } from "@/lib/sentry-common";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(SENTRY_OPTIONS);
  }
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
