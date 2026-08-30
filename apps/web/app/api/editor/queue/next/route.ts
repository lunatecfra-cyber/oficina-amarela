import { createApp } from "@oficina/api/app";

/**
 * Adaptador: a rota da fila do editor passou para o Hono, em apps/api.
 *
 * O Next só encaminha. Quando os dois Workers estiverem no ar, este arquivo
 * troca `api.fetch` por um Service Binding e some — a assinatura é a mesma,
 * que é justamente o motivo de o Hono expor `fetch(Request)`.
 */
const api = createApp();

function toApiRequest(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api/, "");
  return new Request(url, request);
}

export function GET(request: Request) {
  return api.fetch(toApiRequest(request));
}

export function POST(request: Request) {
  return api.fetch(toApiRequest(request));
}
