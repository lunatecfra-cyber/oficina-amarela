import { cloudflare } from "@cloudflare/vite-plugin";
import { cdnAdapter } from "@vinext/cloudflare/cache/cdn-adapter";
import vinext from "vinext";
import { defineConfig } from "vite";

/**
 * Build do apps/web para Cloudflare Workers com vinext (ARCH-01).
 *
 * Convive com `next build`: o Next continua sendo o caminho do Vercel enquanto
 * a migração não termina, e este arquivo é o caminho do Worker. Nenhum dos dois
 * lê a configuração do outro.
 */
export default defineConfig({
  plugins: [
    vinext({
      cache: { cdn: cdnAdapter() },
    }),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
