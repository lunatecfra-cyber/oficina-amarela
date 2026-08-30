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

  // Os cabeçalhos de uma requisição que chega ao Worker são imutáveis, e
  // `new Request(url, request)` leva essa imutabilidade adiante: do outro lado
  // do Service Binding o runtime tenta ajustá-los e estoura com "Can't modify
  // immutable headers". Copiar para um Headers novo devolve uma requisição que
  // o binding pode tratar como sua.
  const init: RequestInit = {
    method: request.method,
    headers: new Headers(request.headers),
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // Corpo em streaming exige duplex; sem isso o runtime recusa o Request.
    (init as { duplex?: string }).duplex = "half";
  }

  return respondMutable(binding.fetch(new Request(url, init)));
}

/**
 * Chamada server-side para a API pelo Service Binding (ou em processo).
 *
 * Repassa cookies da requisição atual quando existirem para preservar a sessão
 * do usuário automaticamente.
 */
export async function fetchApi(
  path: string,
  init?: RequestInit,
  binding: ApiServiceBinding = apiBinding ?? localApi,
): Promise<Response> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `http://api.local${normalizedPath}`;
  const headers = new Headers(init?.headers);

  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const cookieHeader = jar.toString();
    if (cookieHeader && !headers.has("cookie")) {
      headers.set("cookie", cookieHeader);
    }
  } catch {
    // Fora do contexto de requisição do Next (build time / testes sem headers)
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
  };
  return respondMutable(binding.fetch(new Request(url, requestInit)));
}

export async function fetchApiJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetchApi(path, init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * A resposta que volta do Service Binding também tem cabeçalhos imutáveis, e o
 * Next tenta ajustá-los antes de entregar — mesmo "Can't modify immutable
 * headers", agora na volta. Recopiar é o que torna a resposta desta aplicação.
 */
async function respondMutable(pending: Promise<Response> | Response): Promise<Response> {
  const response = await pending;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
}
