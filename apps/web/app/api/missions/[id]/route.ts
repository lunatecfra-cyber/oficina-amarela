import { createApp } from "@oficina/api/app";

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
