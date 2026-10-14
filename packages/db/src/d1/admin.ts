import { roleFromDb } from "../accounts.ts";
import type {
  AdminRepository,
  MissionInFlight,
  QueueItem,
  QueueMove,
  Report,
  SystemOverview,
  UserDetail,
  UserListItem,
} from "../admin.ts";
import { createD1Accounts } from "./accounts.ts";
import type { D1DatabaseLike } from "./types.ts";

export function createD1Admin(db: D1DatabaseLike): AdminRepository {
  return {
    async searchUsers(term: string): Promise<UserListItem[]> {
      const t = term.trim();
      const pattern = `%${t}%`;
      const query = t
        ? db
            .prepare(
              `SELECT id, handle, name, email, role, is_banned, profile_completed, created_at
             FROM users
             WHERE name LIKE ? OR handle LIKE ? OR email LIKE ?
             ORDER BY CASE WHEN handle LIKE ? THEN 0 ELSE 1 END, created_at DESC
             LIMIT 20`,
            )
            .bind(pattern, pattern, pattern, pattern)
        : db.prepare(
            `SELECT id, handle, name, email, role, is_banned, profile_completed, created_at
             FROM users
             ORDER BY created_at DESC
             LIMIT 20`,
          );

      const result = await query.all<{
        id: number;
        handle: string;
        name: string;
        email: string;
        role: string;
        is_banned: number | boolean;
        profile_completed: number | boolean;
        created_at: string | null;
      }>();

      return (result.results ?? []).map((l) => {
        const role = roleFromDb(l.role);
        return {
          id: Number(l.id),
          handle: String(l.handle),
          name: String(l.name),
          email: String(l.email),
          role,
          isBanned: Boolean(l.is_banned),
          profileCompleted: Boolean(l.profile_completed),
          createdAt: l.created_at ?? "",
          apelido: String(l.handle),
          nome: String(l.name),
          papel: role,
          banido: Boolean(l.is_banned),
          perfilCompleto: Boolean(l.profile_completed),
          criadoEm: l.created_at ?? "",
        };
      });
    },

    async viewUserDetails(userId: number): Promise<UserDetail | null> {
      const row = await db
        .prepare(
          `SELECT
             id, handle, name, email, role, is_banned, profile_completed, created_at,
             avatar_url, location, bio,
             delivered_count, reputation, streak, rating,
             political_office, running_for, election_year,
             banned_at, ban_reason
           FROM users
           WHERE id = ?`,
        )
        .bind(userId)
        .first<{
          id: number;
          handle: string;
          name: string;
          email: string;
          role: string;
          is_banned: number | boolean;
          profile_completed: number | boolean;
          created_at: string | null;
          avatar_url: string | null;
          location: string | null;
          bio: string | null;
          delivered_count: number;
          reputation: number;
          streak: number;
          rating: number | null;
          political_office: string | null;
          running_for: string | null;
          election_year: string | null;
          banned_at: string | null;
          ban_reason: string | null;
        }>();

      if (!row) return null;

      const countRow = await db
        .prepare(
          `SELECT count(*) AS total
           FROM missions
           WHERE reserved_by_id = ?
             AND status IN ('reservada','oferecida','reedicao','em_revisao')`,
        )
        .bind(userId)
        .first<{ total: number }>();

      const role = roleFromDb(row.role);

      return {
        id: Number(row.id),
        handle: String(row.handle),
        name: String(row.name),
        email: String(row.email),
        role,
        isBanned: Boolean(row.is_banned),
        profileCompleted: Boolean(row.profile_completed),
        createdAt: row.created_at ?? "",
        avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
        location: row.location ? String(row.location) : null,
        bio: row.bio ? String(row.bio) : null,
        deliveredCount: Number(row.delivered_count ?? 0),
        reputation: Number(row.reputation ?? 0),
        streak: Number(row.streak ?? 0),
        rating: row.rating === null ? null : Number(row.rating),
        politicalOffice: row.political_office ? String(row.political_office) : null,
        runningFor: row.running_for ? String(row.running_for) : null,
        electionYear: row.election_year ? String(row.election_year) : null,
        bannedAt: row.banned_at ? String(row.banned_at) : null,
        banReason: row.ban_reason ? String(row.ban_reason) : null,
        activeMissions: Number(countRow?.total ?? 0),
        apelido: String(row.handle),
        nome: String(row.name),
        papel: role,
        banido: Boolean(row.is_banned),
        perfilCompleto: Boolean(row.profile_completed),
        criadoEm: row.created_at ?? "",
        fotoUrl: row.avatar_url ? String(row.avatar_url) : null,
        localizacao: row.location ? String(row.location) : null,
        entregues: Number(row.delivered_count ?? 0),
        reputacao: Number(row.reputation ?? 0),
        nota: row.rating === null ? null : Number(row.rating),
        cargo: row.political_office ? String(row.political_office) : null,
        disputaPor: row.running_for ? String(row.running_for) : null,
        anoEleicao: row.election_year ? String(row.election_year) : null,
        banidoEm: row.banned_at ? String(row.banned_at) : null,
        motivoBanimento: row.ban_reason ? String(row.ban_reason) : null,
        pautasAtivas: Number(countRow?.total ?? 0),
      };
    },

    async banUser(userId: number, reason: string) {
      const cleanReason = reason.trim();
      if (!cleanReason) {
        return {
          ok: false,
          error: "Escreva o motivo do banimento.",
          erro: "Escreva o motivo do banimento.",
        };
      }
      if (cleanReason.length > 500) {
        return {
          ok: false,
          error: "Motivo longo demais (máx. 500).",
          erro: "Motivo longo demais (máx. 500).",
        };
      }

      const updated = await db
        .prepare(
          `UPDATE users
           SET is_banned = 1,
               banned_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
               ban_reason = ?,
               sessions_valid_after = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ? AND role <> 'admin'
           RETURNING id`,
        )
        .bind(cleanReason, userId)
        .first<{ id: number }>();

      if (!updated) {
        return {
          ok: false,
          error: "Não dá pra banir essa conta (admin ou inexistente).",
          erro: "Não dá pra banir essa conta (admin ou inexistente).",
        };
      }
      return { ok: true };
    },

    async unbanUser(userId: number) {
      const updated = await db
        .prepare(
          `UPDATE users
           SET is_banned = 0,
               banned_at = null,
               ban_reason = null
           WHERE id = ?
           RETURNING id`,
        )
        .bind(userId)
        .first<{ id: number }>();

      if (!updated)
        return { ok: false, error: "Conta não encontrada.", erro: "Conta não encontrada." };
      return { ok: true };
    },

    async removeUser(userId: number) {
      const target = await db
        .prepare("SELECT id, handle, role FROM users WHERE id = ?")
        .bind(userId)
        .first<{ id: number; handle: string; role: string }>();

      if (!target)
        return { ok: false, error: "Conta não encontrada.", erro: "Conta não encontrada." };
      if (target.role === "admin") {
        return {
          ok: false,
          error: "Conta de inspetor não pode ser apagada por aqui.",
          erro: "Conta de inspetor não pode ser apagada por aqui.",
        };
      }

      try {
        await createD1Accounts(db).deleteAccount(userId);
      } catch (error) {
        if (!/evidence_retained/.test(String(error))) throw error;
        return { ok: false, error: "Conta com evidências sob retenção. A exclusão foi bloqueada." };
      }
      return { ok: true, handle: String(target.handle), apelido: String(target.handle) };
    },

    async reportsForInspector(): Promise<Report[]> {
      const result = await db
        .prepare(
          `SELECT r.id, r.mission_id, r.body AS text, r.status, r.created_at,
                  f.actor_name AS forwarded_by,f.reason AS forwarding_reason,f.created_at AS forwarded_at,
                  d.actor_name AS decided_by,d.reason AS decision_reason,d.created_at AS decided_at,x.created_at AS retention_released_at,c.captured_at AS evidence_captured_at,
                  p.title AS mission_title, p.status AS mission_status,
                  u1.name AS reporter_name, u1.handle AS reporter_handle, u1.id AS reporter_id,
                  u2.name AS reported_name, u2.handle AS reported_handle, u2.id AS reported_id
           FROM reports r
           JOIN missions p ON p.id = r.mission_id
           JOIN users u1 ON u1.id = r.reporter_id
           LEFT JOIN users u2 ON u2.id = r.reported_id
           LEFT JOIN report_forwardings f ON f.id=(SELECT MAX(id) FROM report_forwardings WHERE report_id=r.id)
           LEFT JOIN report_decisions d ON d.report_id=r.id
           LEFT JOIN report_retention_releases x ON x.report_id=r.id
           LEFT JOIN report_evidence_captures c ON c.report_id=r.id
           ORDER BY CASE WHEN r.status = 'aberta' THEN 0 ELSE 1 END, r.created_at DESC`,
        )
        .all<{
          id: number;
          mission_id: number;
          text: string;
          status: string;
          created_at: string;
          mission_title: string;
          mission_status: string;
          reporter_name: string;
          reporter_handle: string;
          reporter_id: number;
          reported_name: string | null;
          reported_handle: string | null;
          reported_id: number | null;
          forwarded_by: string | null;
          forwarding_reason: string | null;
          forwarded_at: string | null;
          decided_by: string | null;
          decision_reason: string | null;
          decided_at: string | null;
          retention_released_at: string | null;
          evidence_captured_at: string | null;
        }>();

      return (result.results ?? []).map((r) => {
        const statusMap: Record<string, "open" | "resolved" | "ignored"> = {
          aberta: "open",
          resolvida: "resolved",
          ignorada: "ignored",
        };
        const normStatus = statusMap[String(r.status)] ?? "open";
        return {
          id: Number(r.id),
          missionId: Number(r.mission_id),
          missionTitle: String(r.mission_title),
          missionStatus: String(r.mission_status),
          reporterId: Number(r.reporter_id),
          reporterName: String(r.reporter_name),
          reporterHandle: String(r.reporter_handle),
          reportedId: r.reported_id ? Number(r.reported_id) : null,
          reportedName: r.reported_name ? String(r.reported_name) : null,
          reportedHandle: r.reported_handle ? String(r.reported_handle) : null,
          text: String(r.text),
          status: normStatus,
          createdAt: String(r.created_at),
          forwardedBy: r.forwarded_by,
          forwardingReason: r.forwarding_reason,
          forwardedAt: r.forwarded_at,
          decidedBy: r.decided_by,
          decisionReason: r.decision_reason,
          decidedAt: r.decided_at,
          retentionReleasedAt: r.retention_released_at,
          evidenceCapturedAt: r.evidence_captured_at,
          pautaId: Number(r.mission_id),
          pautaTitulo: String(r.mission_title),
          pautaStatus: String(r.mission_status),
          denuncianteId: Number(r.reporter_id),
          denuncianteNome: String(r.reporter_name),
          denuncianteApelido: String(r.reporter_handle),
          denunciadoId: r.reported_id ? Number(r.reported_id) : null,
          denunciadoNome: r.reported_name ? String(r.reported_name) : null,
          denunciadoApelido: r.reported_handle ? String(r.reported_handle) : null,
          texto: String(r.text),
          criadaEm: String(r.created_at),
        };
      });
    },

    async resolveReport(id, status, actorId, reason) {
      const normStatus = status === "resolved" || status === "resolvida" ? "resolvida" : "ignorada";
      if (!reason.trim() || reason.trim().length < 5 || reason.trim().length > 1000)
        return { ok: false, error: "Informe a justificativa (5 a 1000 caracteres)." };
      try {
        await db
          .prepare(`INSERT INTO report_decisions(report_id,actor_id,actor_name,status,reason)
          SELECT ?,id,name,?,? FROM users WHERE id=? AND EXISTS(SELECT 1 FROM authorized_user_capabilities c WHERE c.user_id=users.id AND c.capability='reports.decide')
          ON CONFLICT(report_id) DO NOTHING`)
          .bind(id, normStatus, reason.trim(), actorId)
          .run();
      } catch (error) {
        if (!/report_decision_unavailable/.test(String(error))) throw error;
      }
      const decision = await db
        .prepare("SELECT actor_id,status,reason FROM report_decisions WHERE report_id=?")
        .bind(id)
        .first<{ actor_id: number; status: string; reason: string }>();
      if (
        decision?.actor_id === actorId &&
        decision.status === normStatus &&
        decision.reason === reason.trim()
      )
        return { ok: true };
      return { ok: false, error: "Denúncia já decidida ou indisponível para este responsável." };
    },

    async getSystemOverview(): Promise<SystemOverview> {
      const p = await db
        .prepare(
          `SELECT
             count(CASE WHEN status = 'disponivel' THEN 1 END) AS na_fila,
             count(CASE WHEN status = 'oferecida' THEN 1 END) AS oferecidas,
             count(CASE WHEN status = 'reservada' THEN 1 END) AS em_edicao,
             count(CASE WHEN status = 'em_revisao' THEN 1 END) AS em_conferencia,
             count(CASE WHEN status = 'reedicao' THEN 1 END) AS em_reedicao,
             count(CASE WHEN status IN ('aprovada','finalizada') THEN 1 END) AS concluidas
           FROM missions`,
        )
        .first<{
          na_fila: number;
          oferecidas: number;
          em_edicao: number;
          em_conferencia: number;
          em_reedicao: number;
          concluidas: number;
        }>();

      const u = await db
        .prepare(
          `SELECT
             count(CASE WHEN role IN ('voz', 'spokesperson') AND (is_banned = 0 OR is_banned = false OR is_banned IS NULL) THEN 1 END) AS candidatos,
             count(CASE WHEN role = 'editor' AND (is_banned = 0 OR is_banned = false OR is_banned IS NULL) THEN 1 END) AS editores,
             count(CASE WHEN is_banned = 1 OR is_banned = true THEN 1 END) AS banidos,
             count(CASE WHEN role = 'editor' AND (is_banned = 0 OR is_banned = false OR is_banned IS NULL) AND (profile_completed = 1 OR profile_completed = true)
               AND NOT EXISTS (
                 SELECT 1 FROM missions p
                 WHERE p.reserved_by_id = users.id AND p.status IN ('reservada','em_revisao','reedicao')
               )
               AND NOT EXISTS (
                 SELECT 1 FROM offers o WHERE o.editor_id = users.id AND o.status = 'pendente'
               )
             THEN 1 END) AS editores_livres
           FROM users`,
        )
        .first<{
          candidatos: number;
          editores: number;
          banidos: number;
          editores_livres: number;
        }>();

      // Convites que vencem em até três dias contam como "vencendo".
      const nowIso = new Date().toISOString();
      const soonIso = new Date(Date.now() + 3 * 86_400_000).toISOString();
      const a = await db
        .prepare(
          `SELECT
             (SELECT count(*) FROM missions m WHERE m.status = 'em_revisao'
                AND NOT EXISTS (SELECT 1 FROM mission_inspection_assignments s
                                WHERE s.mission_id = m.id AND s.version = m.delivery_version)) AS sem_inspetor,
             (SELECT min(d.submitted_at) FROM missions m
                JOIN mission_deliveries d ON d.mission_id = m.id AND d.version = m.delivery_version
                WHERE m.status = 'em_revisao') AS mais_antiga,
             (SELECT count(*) FROM reports WHERE status = 'aberta') AS denuncias_abertas,
             (SELECT count(*) FROM spokesperson_invitations
                WHERE revoked_at IS NULL AND used_at IS NULL AND expires_at > ?) AS convites_validos,
             (SELECT count(*) FROM spokesperson_invitations
                WHERE revoked_at IS NULL AND used_at IS NULL AND expires_at > ? AND expires_at <= ?) AS convites_vencendo`,
        )
        .bind(nowIso, nowIso, soonIso)
        .first<{
          sem_inspetor: number;
          mais_antiga: string | null;
          denuncias_abertas: number;
          convites_validos: number;
          convites_vencendo: number;
        }>();

      const inQueue = Number(p?.na_fila ?? 0);
      const offered = Number(p?.oferecidas ?? 0);
      const inEditing = Number(p?.em_edicao ?? 0);
      const inReview = Number(p?.em_conferencia ?? 0);
      const inRevision = Number(p?.em_reedicao ?? 0);
      const completed = Number(p?.concluidas ?? 0);
      const spokespersons = Number(u?.candidatos ?? 0);
      const editors = Number(u?.editores ?? 0);
      const freeEditors = Number(u?.editores_livres ?? 0);
      const banned = Number(u?.banidos ?? 0);

      return {
        inQueue,
        offered,
        inEditing,
        inReview,
        inRevision,
        inReedit: inRevision,
        completed,
        spokespersons,
        candidates: spokespersons,
        editors,
        freeEditors,
        banned,
        attention: {
          unassignedInspections: Number(a?.sem_inspetor ?? 0),
          oldestInspectionAt: a?.mais_antiga ?? null,
          openReports: Number(a?.denuncias_abertas ?? 0),
          validInvitations: Number(a?.convites_validos ?? 0),
          expiringInvitations: Number(a?.convites_vencendo ?? 0),
        },
        naFila: inQueue,
        oferecidas: offered,
        emEdicao: inEditing,
        emConferencia: inReview,
        emReedicao: inRevision,
        concluidas: completed,
        candidatos: spokespersons,
        editores: editors,
        editoresLivres: freeEditors,
        banidos: banned,
      };
    },

    async getEditingQueue(): Promise<QueueItem[]> {
      const result = await db
        .prepare(
          `SELECT p.id, p.title, p.format, p.created_at, p.priority, p.status,
                  v.name AS candidate,
                  e.handle AS offered_to,
                  o.offered_at
           FROM missions p
           JOIN users v ON v.id = p.spokesperson_id
           LEFT JOIN offers o ON o.mission_id = p.id AND o.status = 'pendente'
           LEFT JOIN users e ON e.id = o.editor_id
           WHERE p.status IN ('disponivel','oferecida')
           ORDER BY p.priority DESC, p.created_at ASC`,
        )
        .all<{
          id: number;
          title: string;
          format: string;
          created_at: string;
          priority: number;
          status: string;
          candidate: string;
          offered_to: string | null;
          offered_at: string | null;
        }>();

      return (result.results ?? []).map((l) => ({
        id: Number(l.id),
        title: String(l.title),
        format: String(l.format),
        spokesperson: String(l.candidate),
        candidateName: String(l.candidate),
        createdAt: new Date(l.created_at).toISOString(),
        priority: Number(l.priority),
        status: String(l.status),
        offeredTo: l.offered_to ? String(l.offered_to) : null,
        offeredAt: l.offered_at ? new Date(l.offered_at).toISOString() : null,
        titulo: String(l.title),
        formato: String(l.format),
        candidato: String(l.candidate),
        criadaEm: new Date(l.created_at).toISOString(),
        prioridade: Number(l.priority),
        oferecidaPara: l.offered_to ? String(l.offered_to) : null,
        oferecidaEm: l.offered_at ? new Date(l.offered_at).toISOString() : null,
      }));
    },

    async getMissionsInFlight(): Promise<MissionInFlight[]> {
      const result = await db
        .prepare(
          `SELECT p.id, p.title, p.status, p.reserved_at, p.delivery_link,
                  v.name AS candidate, e.handle AS editor
           FROM missions p
           JOIN users v ON v.id = p.spokesperson_id
           LEFT JOIN users e ON e.id = p.reserved_by_id
           WHERE p.status IN ('reservada','em_revisao','reedicao')
           ORDER BY p.reserved_at ASC`,
        )
        .all<{
          id: number;
          title: string;
          status: string;
          reserved_at: string | null;
          delivery_link: string | null;
          candidate: string;
          editor: string | null;
        }>();

      return (result.results ?? []).map((l) => ({
        id: Number(l.id),
        title: String(l.title),
        status: String(l.status),
        spokesperson: String(l.candidate),
        candidateName: String(l.candidate),
        editor: l.editor ? String(l.editor) : null,
        since: l.reserved_at ? new Date(l.reserved_at).toISOString() : null,
        hasDelivery: Boolean(l.delivery_link),
        titulo: String(l.title),
        candidato: String(l.candidate),
        desde: l.reserved_at ? new Date(l.reserved_at).toISOString() : null,
        temEntrega: Boolean(l.delivery_link),
      }));
    },

    async moveInQueue(missionId: number, movement: QueueMove) {
      const result = await db
        .prepare(
          `SELECT id FROM missions
           WHERE status IN ('disponivel','oferecida')
           ORDER BY priority DESC, created_at ASC`,
        )
        .all<{ id: number }>();

      const ids = (result.results ?? []).map((l) => Number(l.id));
      const fromIdx = ids.indexOf(missionId);
      if (fromIdx === -1) {
        return {
          ok: false,
          error: "Essa missão não está mais na fila.",
          erro: "Essa missão não está mais na fila.",
        };
      }

      const toIdx =
        movement === "top" || movement === "topo"
          ? 0
          : movement === "up" || movement === "subir"
            ? fromIdx - 1
            : fromIdx + 1;

      if (toIdx < 0 || toIdx >= ids.length) {
        return {
          ok: false,
          error: "Ela já está nessa ponta da fila.",
          erro: "Ela já está nessa ponta da fila.",
        };
      }

      ids.splice(fromIdx, 1);
      ids.splice(toIdx, 0, missionId);

      const priorities = ids.map((_, i) => ids.length - i);
      const stmts = ids.map((id, idx) =>
        db.prepare("UPDATE missions SET priority = ? WHERE id = ?").bind(priorities[idx], id),
      );
      if (typeof db.batch === "function") {
        await db.batch(stmts);
      } else {
        for (const s of stmts) {
          await s.run();
        }
      }

      return { ok: true };
    },

    async getActiveEditorEmails() {
      const result = await db
        .prepare(
          `SELECT name, email FROM users
           WHERE role = 'editor' AND (is_banned = 0 OR is_banned = false OR is_banned IS NULL)
           ORDER BY name ASC`,
        )
        .all<{ name: string; email: string }>();

      return (result.results ?? []).map((l) => ({
        name: String(l.name),
        email: String(l.email),
        nome: String(l.name),
      }));
    },

    async getActiveSpokespersonEmails() {
      const result = await db
        .prepare(
          `SELECT name, email FROM users
           WHERE role IN ('voz', 'spokesperson') AND (is_banned = 0 OR is_banned = false OR is_banned IS NULL)
           ORDER BY name ASC`,
        )
        .all<{ name: string; email: string }>();

      return (result.results ?? []).map((l) => ({
        name: String(l.name),
        email: String(l.email),
        nome: String(l.name),
      }));
    },
  };
}
