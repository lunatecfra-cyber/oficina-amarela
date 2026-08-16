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
  // o Sentry manda o evento do navegador direto pro ingest dele; com
  // `connect-src 'self'` sozinho, todo erro de cliente morreria bloqueado
  // pela CSP — e a gente ficaria cego sem perceber. Curinga de subdomínio em
  // vez do host do projeto: assim não quebra se o DSN mudar.
  "connect-src 'self' https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
  "form-action 'self'",
  // o tutorial do Drive embute o vídeo (lib/tutoriais.ts). Sem esta linha ele
  // cai no `default-src 'self'` e nasce bloqueado — hoje só no relatório,
  // mas quebrado de verdade no dia em que a CSP passar a valer.
  // Só estes dois hosts: `urlDeEmbutir` já recusa qualquer outro, e a CSP é a
  // segunda tranca caso alguém mexa naquela função.
  "frame-src https://www.youtube-nocookie.com https://drive.google.com",
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
          // sem `preload`: entrar na lista de preload dos navegadores é
          // praticamente irreversível (sai em meses, não em horas). Com um
          // domínio novo e ainda sem DNS configurado, é cedo demais pra
          // assumir esse compromisso. O max-age já protege quem visita.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
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
