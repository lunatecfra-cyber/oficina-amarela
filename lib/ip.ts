/**
 * De onde veio a requisição — a chave pra travar cadastro em massa.
 *
 * Atrás de proxy (Vercel), o IP real está no cabeçalho, não no socket. O
 * primeiro item de `x-forwarded-for` é o cliente; o resto é a cadeia de
 * proxies.
 *
 * Cabeçalho é falsificável por quem fala direto com o servidor, então isto
 * NÃO serve como autenticação — serve como freio, que é o uso aqui.
 * Em desenvolvimento não existe cabeçalho nenhum: cai em "local", e todo
 * mundo divide o mesmo balde (o que é justo, é uma máquina só).
 */
export function ipDaRequisicao(request: Request): string {
  const encaminhado = request.headers.get("x-forwarded-for");
  if (encaminhado) return encaminhado.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
}
