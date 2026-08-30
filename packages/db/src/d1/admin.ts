import type { Role } from "@oficina/auth/session";
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
import type { D1DatabaseLike } from "./types.ts";

function normalizeRoleFromDb(papel: string): Role {
  if (papel === "voz" || papel === "spokesperson") return "spokesperson";
  if (papel === "admin") return "admin";
  return "editor";
}

export function createD1Admin(db: D1DatabaseLike): AdminRepository {
  return {
    async searchUsers(term: string): Promise<UserListItem[]> {
      const t = term.trim();
      const pattern = `%${t}%`;
      const query = t
        ? db
            .prepare(
              `SELECT id, apelido, nome, email, papel, banido, perfil_completo, criado_em
             FROM users
             WHERE nome LIKE ? OR apelido LIKE ? OR email LIKE ?
             ORDER BY CASE WHEN apelido LIKE ? THEN 0 ELSE 1 END, criado_em DESC
             LIMIT 20`,
            )
            .bind(pattern, pattern, pattern, pattern)
        : db.prepare(
            `SELECT id, apelido, nome, email, papel, banido, perfil_completo, criado_em
             FROM users
             ORDER BY criado_em DESC
             LIMIT 20`,
          );

      const result = await query.all<{
        id: number;
        apelido: string;
        nome: string;
        email: string;
        papel: string;
        banido: number | boolean;
        perfil_completo: number | boolean;
        criado_em: string;
      }>();

      return (result.results ?? []).map((l) => {
        const role = normalizeRoleFromDb(l.papel);
        return {
          id: Number(l.id),
          handle: String(l.apelido),
          name: String(l.nome),
          email: String(l.email),
          role,
          isBanned: Boolean(l.banido),
          profileCompleted: Boolean(l.perfil_completo),
          createdAt: String(l.criado_em),
          apelido: String(l.apelido),
          nome: String(l.nome),
          papel: role,
          banido: Boolean(l.banido),
          perfilCompleto: Boolean(l.perfil_completo),
          criadoEm: String(l.criado_em),
        };
      });
    },

    async viewUserDetails(userId: number): Promise<UserDetail | null> {
      const row = await db
        .prepare(
          `SELECT
             id, apelido, nome, email, papel, banido, perfil_completo, criado_em,
             foto_url, localizacao, bio,
             entregues, reputacao, streak, nota,
             cargo, disputa_por, ano_eleicao,
             banido_em, motivo_banimento
           FROM users
           WHERE id = ?`,
        )
        .bind(userId)
        .first<{
          id: number;
          apelido: string;
          nome: string;
          email: string;
          papel: string;
          banido: number | boolean;
          perfil_completo: number | boolean;
          criado_em: string;
          foto_url: string | null;
          localizacao: string | null;
          bio: string | null;
          entregues: number;
          reputacao: number;
          streak: number;
          nota: number | null;
          cargo: string | null;
          disputa_por: string | null;
          ano_eleicao: string | null;
          banido_em: string | null;
          motivo_banimento: string | null;
        }>();

      if (!row) return null;

      const countRow = await db
        .prepare(
          `SELECT count(*) AS total
           FROM pautas
           WHERE reservada_por_id = ?
             AND status IN ('reservada','oferecida','reedicao','em_revisao')`,
        )
        .bind(userId)
        .first<{ total: number }>();

      const role = normalizeRoleFromDb(row.papel);

      return {
        id: Number(row.id),
        handle: String(row.apelido),
        name: String(row.nome),
        email: String(row.email),
        role,
        isBanned: Boolean(row.banido),
        profileCompleted: Boolean(row.perfil_completo),
        createdAt: String(row.criado_em),
        avatarUrl: row.foto_url ? String(row.foto_url) : null,
        location: row.localizacao ? String(row.localizacao) : null,
        bio: row.bio ? String(row.bio) : null,
        deliveredCount: Number(row.entregues ?? 0),
        reputation: Number(row.reputacao ?? 0),
        streak: Number(row.streak ?? 0),
        rating: row.nota === null ? null : Number(row.nota),
        politicalOffice: row.cargo ? String(row.cargo) : null,
        runningFor: row.disputa_por ? String(row.disputa_por) : null,
        electionYear: row.ano_eleicao ? String(row.ano_eleicao) : null,
        bannedAt: row.banido_em ? String(row.banido_em) : null,
        banReason: row.motivo_banimento ? String(row.motivo_banimento) : null,
        activeMissions: Number(countRow?.total ?? 0),
        apelido: String(row.apelido),
        nome: String(row.nome),
        papel: role,
        banido: Boolean(row.banido),
        perfilCompleto: Boolean(row.perfil_completo),
        criadoEm: String(row.criado_em),
        fotoUrl: row.foto_url ? String(row.foto_url) : null,
        localizacao: row.localizacao ? String(row.localizacao) : null,
        entregues: Number(row.entregues ?? 0),
        reputacao: Number(row.reputacao ?? 0),
        nota: row.nota === null ? null : Number(row.nota),
        cargo: row.cargo ? String(row.cargo) : null,
        disputaPor: row.disputa_por ? String(row.disputa_por) : null,
        anoEleicao: row.ano_eleicao ? String(row.ano_eleicao) : null,
        banidoEm: row.banido_em ? String(row.banido_em) : null,
        motivoBanimento: row.motivo_banimento ? String(row.motivo_banimento) : null,
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
           SET banido = 1,
               banido_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
               motivo_banimento = ?,
               sessoes_validas_apos = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ? AND papel <> 'admin'
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
           SET banido = 0,
               banido_em = null,
               motivo_banimento = null
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
        .prepare("SELECT id, apelido, papel FROM users WHERE id = ?")
        .bind(userId)
        .first<{ id: number; apelido: string; papel: string }>();

      if (!target)
        return { ok: false, error: "Conta não encontrada.", erro: "Conta não encontrada." };
      if (target.papel === "admin") {
        return {
          ok: false,
          error: "Conta de inspetor não pode ser apagada por aqui.",
          erro: "Conta de inspetor não pode ser apagada por aqui.",
        };
      }

      await db
        .prepare(
          `UPDATE pautas
           SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL, reservada_em = NULL
           WHERE reservada_por_id = ? AND status IN ('reservada','reedicao','oferecida')`,
        )
        .bind(userId)
        .run();

      await db.prepare("DELETE FROM users WHERE id = ?").bind(userId).run();
      return { ok: true, handle: String(target.apelido), apelido: String(target.apelido) };
    },

    async reportsForInspector(): Promise<Report[]> {
      const result = await db
        .prepare(
          `SELECT r.id, r.pauta_id, r.texto, r.status, r.criada_em,
                  p.titulo AS pauta_titulo, p.status AS pauta_status,
                  u1.nome AS denunciante_nome, u1.apelido AS denunciante_apelido, u1.id AS denunciante_id,
                  u2.nome AS denunciado_nome, u2.apelido AS denunciado_apelido, u2.id AS denunciado_id
           FROM denuncias r
           JOIN pautas p ON p.id = r.pauta_id
           JOIN users u1 ON u1.id = r.denunciante_id
           LEFT JOIN users u2 ON u2.id = r.denunciado_id
           ORDER BY CASE WHEN r.status = 'aberta' THEN 0 ELSE 1 END, r.criada_em DESC`,
        )
        .all<{
          id: number;
          pauta_id: number;
          texto: string;
          status: string;
          criada_em: string;
          pauta_titulo: string;
          pauta_status: string;
          denunciante_nome: string;
          denunciante_apelido: string;
          denunciante_id: number;
          denunciado_nome: string | null;
          denunciado_apelido: string | null;
          denunciado_id: number | null;
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
          missionId: Number(r.pauta_id),
          missionTitle: String(r.pauta_titulo),
          missionStatus: String(r.pauta_status),
          reporterId: Number(r.denunciante_id),
          reporterName: String(r.denunciante_nome),
          reporterHandle: String(r.denunciante_apelido),
          reportedId: r.denunciado_id ? Number(r.denunciado_id) : null,
          reportedName: r.denunciado_nome ? String(r.denunciado_nome) : null,
          reportedHandle: r.denunciado_apelido ? String(r.denunciado_apelido) : null,
          text: String(r.texto),
          status: normStatus,
          createdAt: String(r.criada_em),
          pautaId: Number(r.pauta_id),
          pautaTitulo: String(r.pauta_titulo),
          pautaStatus: String(r.pauta_status),
          denuncianteId: Number(r.denunciante_id),
          denuncianteNome: String(r.denunciante_nome),
          denuncianteApelido: String(r.denunciante_apelido),
          denunciadoId: r.denunciado_id ? Number(r.denunciado_id) : null,
          denunciadoNome: r.denunciado_nome ? String(r.denunciado_nome) : null,
          denunciadoApelido: r.denunciado_apelido ? String(r.denunciado_apelido) : null,
          texto: String(r.texto),
          criadaEm: String(r.criada_em),
        };
      });
    },

    async resolveReport(id, status) {
      const normStatus = status === "resolved" || status === "resolvida" ? "resolvida" : "ignorada";
      const updated = await db
        .prepare(
          `UPDATE denuncias
           SET status = ?, resolvida_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
           WHERE id = ?
           RETURNING id`,
        )
        .bind(normStatus, id)
        .first<{ id: number }>();

      if (!updated)
        return { ok: false, error: "Denúncia não encontrada.", erro: "Denúncia não encontrada." };
      return { ok: true };
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
           FROM pautas`,
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
             count(CASE WHEN papel IN ('voz', 'spokesperson') AND (banido = 0 OR banido = false OR banido IS NULL) THEN 1 END) AS candidatos,
             count(CASE WHEN papel = 'editor' AND (banido = 0 OR banido = false OR banido IS NULL) THEN 1 END) AS editores,
             count(CASE WHEN banido = 1 OR banido = true THEN 1 END) AS banidos,
             count(CASE WHEN papel = 'editor' AND (banido = 0 OR banido = false OR banido IS NULL) AND (perfil_completo = 1 OR perfil_completo = true)
               AND NOT EXISTS (
                 SELECT 1 FROM pautas p
                 WHERE p.reservada_por_id = users.id AND p.status IN ('reservada','em_revisao','reedicao')
               )
               AND NOT EXISTS (
                 SELECT 1 FROM ofertas o WHERE o.editor_id = users.id AND o.status = 'pendente'
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
          `SELECT p.id, p.titulo, p.formato, p.criada_em, p.prioridade, p.status,
                  v.nome AS candidato,
                  e.apelido AS oferecida_para,
                  o.oferecida_em
           FROM pautas p
           JOIN users v ON v.id = p.porta_voz_id
           LEFT JOIN ofertas o ON o.pauta_id = p.id AND o.status = 'pendente'
           LEFT JOIN users e ON e.id = o.editor_id
           WHERE p.status IN ('disponivel','oferecida')
           ORDER BY p.prioridade DESC, p.criada_em ASC`,
        )
        .all<{
          id: number;
          titulo: string;
          formato: string;
          criada_em: string;
          prioridade: number;
          status: string;
          candidato: string;
          oferecida_para: string | null;
          oferecida_em: string | null;
        }>();

      return (result.results ?? []).map((l) => ({
        id: Number(l.id),
        title: String(l.titulo),
        format: String(l.formato),
        spokesperson: String(l.candidato),
        candidateName: String(l.candidato),
        createdAt: new Date(l.criada_em).toISOString(),
        priority: Number(l.prioridade),
        status: String(l.status),
        offeredTo: l.oferecida_para ? String(l.oferecida_para) : null,
        offeredAt: l.oferecida_em ? new Date(l.oferecida_em).toISOString() : null,
        titulo: String(l.titulo),
        formato: String(l.formato),
        candidato: String(l.candidato),
        criadaEm: new Date(l.criada_em).toISOString(),
        prioridade: Number(l.prioridade),
        oferecidaPara: l.oferecida_para ? String(l.oferecida_para) : null,
        oferecidaEm: l.oferecida_em ? new Date(l.oferecida_em).toISOString() : null,
      }));
    },

    async getMissionsInFlight(): Promise<MissionInFlight[]> {
      const result = await db
        .prepare(
          `SELECT p.id, p.titulo, p.status, p.reservada_em, p.entrega_link,
                  v.nome AS candidato, e.apelido AS editor
           FROM pautas p
           JOIN users v ON v.id = p.porta_voz_id
           LEFT JOIN users e ON e.id = p.reservada_por_id
           WHERE p.status IN ('reservada','em_revisao','reedicao')
           ORDER BY p.reservada_em ASC`,
        )
        .all<{
          id: number;
          titulo: string;
          status: string;
          reservada_em: string | null;
          entrega_link: string | null;
          candidato: string;
          editor: string | null;
        }>();

      return (result.results ?? []).map((l) => ({
        id: Number(l.id),
        title: String(l.titulo),
        status: String(l.status),
        spokesperson: String(l.candidato),
        candidateName: String(l.candidato),
        editor: l.editor ? String(l.editor) : null,
        since: l.reservada_em ? new Date(l.reservada_em).toISOString() : null,
        hasDelivery: Boolean(l.entrega_link),
        titulo: String(l.titulo),
        candidato: String(l.candidato),
        desde: l.reservada_em ? new Date(l.reservada_em).toISOString() : null,
        temEntrega: Boolean(l.entrega_link),
      }));
    },

    async moveInQueue(missionId: number, movement: QueueMove) {
      const result = await db
        .prepare(
          `SELECT id FROM pautas
           WHERE status IN ('disponivel','oferecida')
           ORDER BY prioridade DESC, criada_em ASC`,
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
        db.prepare("UPDATE pautas SET prioridade = ? WHERE id = ?").bind(priorities[idx], id),
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
          `SELECT nome, email FROM users
           WHERE papel = 'editor' AND (banido = 0 OR banido = false OR banido IS NULL)
           ORDER BY nome ASC`,
        )
        .all<{ nome: string; email: string }>();

      return (result.results ?? []).map((l) => ({
        name: String(l.nome),
        email: String(l.email),
        nome: String(l.nome),
      }));
    },

    async getActiveSpokespersonEmails() {
      const result = await db
        .prepare(
          `SELECT nome, email FROM users
           WHERE papel IN ('voz', 'spokesperson') AND (banido = 0 OR banido = false OR banido IS NULL)
           ORDER BY nome ASC`,
        )
        .all<{ nome: string; email: string }>();

      return (result.results ?? []).map((l) => ({
        name: String(l.nome),
        email: String(l.email),
        nome: String(l.nome),
      }));
    },
  };
}
