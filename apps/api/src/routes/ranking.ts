import type { UserSession } from "@oficina/auth/session";
import { SLOTS } from "@oficina/domain/limits";
import { Hono } from "hono";
import type { Bindings } from "../app.ts";
import type { ApiDependencies } from "../dependencies.ts";
import { editorProgress, electoralRanking } from "../ranking-service.ts";
import { requireEditor, requireSession } from "../session.ts";

/**
 * Ranking, progresso do editor e vagas.
 *
 * `/slots` é a única leitura pública: a página de cadastro precisa dela antes
 * de existir sessão. As outras duas exigem sessão, e o progresso é sempre o de
 * quem pediu — o id vem da sessão, nunca do corpo, para um editor não conseguir
 * ler o progresso de outro.
 */

type RankingEnv = {
  Bindings: Bindings;
  Variables: { session: UserSession; requestId: string };
};

export function createRankingRoutes(dependencies: ApiDependencies) {
  const routes = new Hono<RankingEnv>();

  routes.get("/slots", async (c) => {
    const [editors, spokespersons] = await Promise.all([
      dependencies.accounts.countByRole("editor"),
      dependencies.accounts.countByRole("spokesperson"),
    ]);
    const slot = (total: number, enrolled: number) => ({
      total,
      enrolled,
      inscritos: enrolled,
      free: Math.max(0, total - enrolled),
      livres: Math.max(0, total - enrolled),
    });
    const spokesperson = slot(SLOTS.spokesperson, spokespersons);
    return c.json({
      editor: slot(SLOTS.editor, editors),
      spokesperson,
      voz: spokesperson,
    });
  });

  routes.get("/ranking", requireSession, async (c) => {
    return c.json(await electoralRanking(dependencies.ranking));
  });

  routes.get("/editor/progress", requireEditor, async (c) => {
    return c.json(await editorProgress(dependencies.ranking, c.get("session").id));
  });

  return routes;
}
