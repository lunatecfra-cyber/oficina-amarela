import { createApp } from "@oficina/api/app";

export type ApiServiceBinding = {
  fetch(request: Request): Promise<Response> | Response;
};

const localApi = createApp();

export function forwardToApi(request: Request, binding: ApiServiceBinding = localApi) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api/, "");
  return binding.fetch(new Request(url, request));
}
