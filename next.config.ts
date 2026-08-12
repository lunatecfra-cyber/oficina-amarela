import type { NextConfig } from "next";

// Cabeçalhos de segurança. Não existia nenhum: o site era emoldurável em
// iframe (clickjacking), o navegador podia adivinhar tipo de conteúdo e o
// Referer vazava a URL inteira pra terceiros.
//
// A CSP entra em Report-Only de propósito. Duas coisas do projeto brigam com
// uma política estrita e precisam ser vistas antes de bloquear:
//   - as fotos são data: URL (por isso `img-src` aceita `data:`)
//   - vários componentes usam `style={{...}}` inline (daí `'unsafe-inline'`
//     em style-src) e o Next injeta script inline na hidratação
// Depois de rodar um tempo sem violação inesperada, trocar o nome do
// cabeçalho pra `Content-Security-Policy` e endurecer o script-src.
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://lh3.googleusercontent.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // a Vercel já serve só HTTPS; isto impede a primeira visita em
          // texto puro depois que o navegador conhece o domínio
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: CSP },
        ],
      },
    ];
  },
};

export default nextConfig;
