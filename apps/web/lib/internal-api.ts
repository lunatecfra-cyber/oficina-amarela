import { createApp } from "@oficina/api/app";

/**
 * Fronteira web → API.
 *
 * O Hono expõe `fetch(Request)`, que é a mesma assinatura do Fetcher de um
 * Service Binding do Cloudflare. Por isso a troca entre os dois é uma
 * atribuição, não uma reescrita: em staging e produção o Worker web registra o
 * binding e a chamada vai de Worker para Worker, sem sair para a internet;
 * localmente e nos testes o padrão é a própria aplicação em processo.
 *
 * O registro é explícito porque a escolha entre vinext e OpenNext (ARCH-01)
 * ainda não está fechada, e cada um expõe o `env` de um jeito. Quem quer que
 * seja o adaptador, ele chama setApiBinding(env.API) uma vez na entrada do
 * Worker — nada aqui precisa saber qual dos dois venceu.
 */

export type ApiServiceBinding = {
  fetch(request: Request): Promise<Response> | Response;
};

const localApi = createApp();
let apiBinding: ApiServiceBinding | null = null;

/** Registra o Service Binding do Worker da API. Sem isso, roda em processo. */
export function setApiBinding(binding: ApiServiceBinding | null | undefined): void {
  apiBinding = binding ?? null;
}

/** Qual ponta atende hoje: útil para log de inicialização e diagnóstico. */
export function apiTransport(): "service-binding" | "in-process" {
  return apiBinding ? "service-binding" : "in-process";
}

/**
 * Registra o binding a partir do env do Worker, se houver um.
 *
 * O especificador vai numa variável de propósito: `cloudflare:workers` só
 * existe dentro do workerd, e um import estático faria o build do Next tentar
 * resolvê-lo. Fora do Worker a falha é esperada e silenciosa — o padrão em
 * processo continua atendendo, que é o que dev e teste usam.
 */
export async function registerApiBindingFromWorkerEnv(): Promise<"service-binding" | "in-process"> {
  try {
    const specifier = "cloudflare:workers";
    const { env } = (await import(/* webpackIgnore: true */ /* @vite-ignore */ specifier)) as {
      env: Record<string, unknown>;
    };
    const binding = env?.API;
    if (binding && typeof (binding as ApiServiceBinding).fetch === "function") {
      setApiBinding(binding as ApiServiceBinding);
    }
  } catch {
    // Fora do workerd não há `cloudflare:workers`: segue em processo.
  }
  return apiTransport();
}

export function forwardToApi(
  request: Request,
  binding: ApiServiceBinding = apiBinding ?? localApi,
) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api/, "");
  return binding.fetch(new Request(url, request));
}
