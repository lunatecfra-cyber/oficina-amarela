import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.dirname(fileURLToPath(import.meta.url));
let cancelled = false;
let version = 0;
const server = await createServer({
  configFile: false,
  root,
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "next/navigation": path.join(root, "navigation.ts"),
      "@": path.resolve(root, "../.."),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 3012,
    strictPort: true,
    fs: { allow: [path.resolve(root, "../../../..")] },
  },
  plugins: [
    {
      name: "local-owner-fixture",
      configureServer(s) {
        s.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/missions/")) return next();
          res.setHeader("Content-Type", "application/json");
          if (req.method === "GET")
            return res.end(
              JSON.stringify({
                ok: true,
                controls: {
                  canCancel: !cancelled,
                  canReassign: !cancelled,
                  reassignAvailableAt: null,
                  cancelled,
                  version,
                },
              }),
            );
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const body = JSON.parse(raw);
          cancelled = body.action === "cancel_mission";
          version++;
          res.end(JSON.stringify({ ok: true }));
        });
      },
    },
  ],
});
await server.listen();
server.printUrls();
