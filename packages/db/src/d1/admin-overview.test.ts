import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { convertV4MiniflareOptions, Miniflare } from "miniflare";
import { createD1Admin } from "./admin.ts";
import { applyAllD1Migrations } from "./schema.ts";
import type { D1DatabaseLike } from "./types.ts";

// Banco próprio: denúncias abertas retêm evidências e impedem limpar tabelas entre testes.
describe("visão geral operacional do administrador em D1", () => {
  const miniflare = new Miniflare(
    convertV4MiniflareOptions({
      compatibilityDate: "2026-08-30",
      d1Databases: { DB: "oficina-admin-overview-tests" },
      modules: true,
      script: "export default { fetch() { return new Response('ok') } }",
    }),
  );
  let db: D1DatabaseLike;
  let repo: ReturnType<typeof createD1Admin>;

  before(async () => {
    db = (await miniflare.getD1Database("DB")) as unknown as D1DatabaseLike;
    await applyAllD1Migrations(db);
    repo = createD1Admin(db);
  });

  after(() => miniflare.dispose());

  test("visão geral informa o que pede ação: inspeção sem inspetor, denúncias abertas e convites", async () => {
    const user = async (handle: string, role: string) =>
      Number(
        (
          await db
            .prepare(
              "INSERT INTO users (handle, name, email, role, profile_completed) VALUES (?, ?, ?, ?, 1) RETURNING id",
            )
            .bind(handle, handle, `${handle}@teste.local`, role)
            .first<{ id: number }>()
        )?.id,
      );
    const [voz, inspector, admin] = [
      await user("av1", "voz"),
      await user("ai1", "inspector"),
      await user("aa1", "admin"),
    ];
    // O índice único de reserva admite uma missão ativa por editor.
    let editor = 0;
    const reviewing = async (title: string, submittedAt: string, assign: boolean) => {
      editor = await user(`ae-${title.replaceAll(" ", "-")}`, "editor");
      const mission = await db
        .prepare(
          "INSERT INTO missions (spokesperson_id, title, format, status, reserved_by_id, delivery_version) VALUES (?, ?, 'curto', 'em_revisao', ?, 1) RETURNING id",
        )
        .bind(voz, title, editor)
        .first<{ id: number }>();
      const id = Number(mission?.id);
      await db
        .prepare(
          "INSERT INTO mission_deliveries (mission_id, version, editor_id, delivery_link, submitted_at) VALUES (?, 1, ?, 'https://exemplo.test/v', ?)",
        )
        .bind(id, editor, submittedAt)
        .run();
      if (assign)
        await db
          .prepare(
            "INSERT INTO mission_inspection_assignments (mission_id, version, inspector_id) VALUES (?, 1, ?)",
          )
          .bind(id, inspector)
          .run();
      return id;
    };
    const mission = await reviewing("Sem inspetor antiga", "2026-10-01T10:00:00.000Z", false);
    await reviewing("Sem inspetor recente", "2026-10-10T10:00:00.000Z", false);
    await reviewing("Já assumida", "2026-09-01T10:00:00.000Z", true);

    const report = (status: string) =>
      db
        .prepare(
          "INSERT INTO reports (mission_id, reporter_id, reported_id, body, status) VALUES (?, ?, ?, 'Relato', ?)",
        )
        .bind(mission, voz, editor, status)
        .run();
    await report("aberta");
    await report("aberta");
    await report("resolvida");

    const day = 86_400_000;
    const invite = (
      n: string,
      expiresAfterMs: number,
      {
        usedAt = null,
        revokedAt = null,
      }: { usedAt?: string | null; revokedAt?: string | null } = {},
    ) =>
      db
        .prepare(
          "INSERT INTO spokesperson_invitations (email, token_hash, created_by, expires_at, used_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(
          `${n}@teste.local`,
          `hash-${n}`,
          admin,
          new Date(Date.now() + expiresAfterMs).toISOString(),
          usedAt,
          revokedAt,
        )
        .run();
    await invite("valido", 10 * day);
    await invite("vencendo", day);
    await invite("expirado", -day);
    await invite("usado", 10 * day, { usedAt: "2026-10-02T10:00:00.000Z" });
    await invite("revogado", 10 * day, { revokedAt: "2026-10-02T10:00:00.000Z" });

    const overview = await repo.getSystemOverview();
    assert.equal(overview.inReview, 3);
    assert.deepEqual(overview.attention, {
      unassignedInspections: 2,
      oldestInspectionAt: "2026-09-01T10:00:00.000Z",
      openReports: 2,
      validInvitations: 2,
      expiringInvitations: 1,
    });
  });
});
