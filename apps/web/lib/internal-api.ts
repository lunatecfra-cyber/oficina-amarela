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

let apiBinding: ApiServiceBinding | null = null;
let localApi: ApiServiceBinding | null = null;

/**
 * A aplicação em processo é o caminho de desenvolvimento e teste, e só ele.
 *
 * O import é dinâmico de propósito. Estático, ele arrastava a API inteira — com
 * todas as rotas e o driver do PostgreSQL — para dentro do bundle do Worker
 * web, que instanciava tudo isso em cada isolate novo. Sob carga o resultado
 * era "Worker exceeded CPU time limit" na home. Em staging e produção o Service
 * Binding sempre existe, então este caminho nunca é tocado.
 */
async function inProcessApi(): Promise<ApiServiceBinding> {
  if (!localApi) {
    const { createApp } = await import("@oficina/api/app");
    localApi = createApp();
  }
  return localApi;
}

/** O binding quando existe; a aplicação em processo só quando não existe. */
async function transport(binding?: ApiServiceBinding): Promise<ApiServiceBinding> {
  return binding ?? apiBinding ?? (await inProcessApi());
}

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

export async function forwardToApi(request: Request, binding?: ApiServiceBinding) {
  const target = await transport(binding);
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

  return respondMutable(target.fetch(new Request(url, init)));
}

/**
 * Chamada server-side para a API pelo Service Binding (ou em processo).
 *
 * Repassa cookies da requisição atual quando existirem para preservar a sessão
 * do usuário automaticamente.
 */
export type FetchApiOptions = {
  /**
   * Repassar o cookie da requisição atual.
   *
   * Ligado por padrão, porque quase toda chamada é em nome de alguém. Mas ler
   * cookie marca a rota como dinâmica no Next, e rota dinâmica não entra em
   * cache: a home tinha `revalidate = 300` e mesmo assim respondia
   * `cache-control: no-store`, renderizando inteira a cada visita. Para dado
   * público, desligue — é o que devolve o cache à página.
   */
  forwardCookies?: boolean;
};

export async function fetchApi(
  path: string,
  init?: RequestInit,
  binding?: ApiServiceBinding,
  options: FetchApiOptions = {},
): Promise<Response> {
  const target = await transport(binding);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `http://api.local${normalizedPath}`;
  const headers = new Headers(init?.headers);

  if (options.forwardCookies !== false) {
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
  }

  const requestInit: RequestInit = {
    ...init,
    headers,
  };
  return respondMutable(target.fetch(new Request(url, requestInit)));
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
 * Leitura de dado público, sem tocar em cookie.
 *
 * É o que mantém a página elegível a cache: sem leitura de cookie o Next não
 * marca a rota como dinâmica, e o `revalidate` da página volta a valer.
 */
export async function fetchPublicApiJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetchApi(path, init, undefined, { forwardCookies: false });
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
