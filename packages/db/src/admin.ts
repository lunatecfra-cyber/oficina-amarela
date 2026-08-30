import type { Role } from "@oficina/auth/session";
import { sql } from "./client.ts";
import { invalidateSessionRevocation } from "./session-revocation.ts";

export type UserListItem = {
  id: number;
  handle: string;
  name: string;
  email: string;
  role: Role;
  isBanned: boolean;
  profileCompleted: boolean;
  createdAt: string;
  // PT-BR aliases
  apelido?: string;
  nome?: string;
  papel?: Role;
  banido?: boolean;
  perfilCompleto?: boolean;
  criadoEm?: string;
};

export type UserDetail = UserListItem & {
  avatarUrl: string | null;
  location: string | null;
  bio: string | null;
  deliveredCount: number;
  reputation: number;
  streak: number;
  rating: number | null;
  politicalOffice: string | null;
  runningFor: string | null;
  electionYear: string | null;
  bannedAt: string | null;
  banReason: string | null;
  activeMissions: number;
  // PT-BR aliases
  fotoUrl?: string | null;
  localizacao?: string | null;
  entregues?: number;
  reputacao?: number;
  nota?: number | null;
  cargo?: string | null;
  disputaPor?: string | null;
  anoEleicao?: string | null;
  banidoEm?: string | null;
  motivoBanimento?: string | null;
  pautasAtivas?: number;
};

export type SystemOverview = {
  inQueue: number;
  offered: number;
  inEditing: number;
  inReview: number;
  inRevision: number;
  inReedit?: number;
  completed: number;
  spokespersons: number;
  candidates?: number;
  editors: number;
  freeEditors: number;
  banned: number;
  // PT-BR aliases
  naFila?: number;
  oferecidas?: number;
  emEdicao?: number;
  emConferencia?: number;
  emReedicao?: number;
  concluidas?: number;
  candidatos?: number;
  editores?: number;
  editoresLivres?: number;
  banidos?: number;
};

export type QueueItem = {
  id: number;
  title: string;
  format: string;
  spokesperson: string;
  candidateName?: string;
  createdAt: string;
  priority: number;
  status: string;
  offeredTo: string | null;
  offeredAt: string | null;
  // PT-BR aliases
  titulo?: string;
  formato?: string;
  candidato?: string;
  criadaEm?: string;
  prioridade?: number;
  oferecidaPara?: string | null;
  oferecidaEm?: string | null;
};

export type MissionInFlight = {
  id: number;
  title: string;
  status: string;
  spokesperson: string;
  candidateName?: string;
  editor: string | null;
  since: string | null;
  hasDelivery: boolean;
  // PT-BR aliases
  titulo?: string;
  candidato?: string;
  desde?: string | null;
  temEntrega?: boolean;
};

export type Report = {
  id: number;
  missionId: number;
  missionTitle: string;
  missionStatus: string;
  reporterId: number;
  reporterName: string;
  reporterHandle: string;
  reportedId: number | null;
  reportedName: string | null;
  reportedHandle: string | null;
  text: string;
  status: "open" | "resolved" | "ignored" | "aberta" | "resolvida" | "ignorada";
  createdAt: string;
  // PT-BR aliases
  pautaId?: number;
  pautaTitulo?: string;
  pautaStatus?: string;
  denuncianteId?: number;
  denuncianteNome?: string;
  denuncianteApelido?: string;
  denunciadoId?: number | null;
  denunciadoNome?: string | null;
  denunciadoApelido?: string | null;
  texto?: string;
  criadaEm?: string;
};

export type QueueMove = "up" | "down" | "top" | "subir" | "descer" | "topo";

function escapeWildcards(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&");
}

function normalizeRoleFromDb(papel: string): Role {
  if (papel === "voz" || papel === "spokesperson") return "spokesperson";
  if (papel === "admin") return "admin";
  return "editor";
}

export type AdminRepository = {
  searchUsers(term: string): Promise<UserListItem[]>;
  viewUserDetails(userId: number): Promise<UserDetail | null>;
  banUser(
    userId: number,
    reason: string,
  ): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  unbanUser(userId: number): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  removeUser(
    userId: number,
  ): Promise<
    { ok: true; handle: string; apelido?: string } | { ok: false; error: string; erro?: string }
  >;
  reportsForInspector(): Promise<Report[]>;
  resolveReport(
    id: number,
    status: "resolved" | "ignored" | "resolvida" | "ignorada",
  ): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  getSystemOverview(): Promise<SystemOverview>;
  getEditingQueue(): Promise<QueueItem[]>;
  getMissionsInFlight(): Promise<MissionInFlight[]>;
  moveInQueue(
    missionId: number,
    movement: QueueMove,
  ): Promise<{ ok: true } | { ok: false; error: string; erro?: string }>;
  getActiveEditorEmails(): Promise<{ name: string; email: string; nome?: string }[]>;
  getActiveSpokespersonEmails(): Promise<{ name: string; email: string; nome?: string }[]>;
};

export const postgresAdmin: AdminRepository = {
  async searchUsers(term: string): Promise<UserListItem[]> {
    const t = term.trim();
    const rows = t
      ? await sql`
          SELECT id, apelido, nome, email, papel, banido, perfil_completo, criado_em
          FROM users
          WHERE
            nome ILIKE ${`%${escapeWildcards(t)}%`}
            OR apelido ILIKE ${`%${escapeWildcards(t)}%`}
            OR email ILIKE ${`%${escapeWildcards(t)}%`}
          ORDER BY
            CASE WHEN apelido ILIKE ${`%${escapeWildcards(t)}%`} THEN 0 ELSE 1 END,
            criado_em DESC
          LIMIT 20
        `
      : await sql`
          SELECT id, apelido, nome, email, papel, banido, perfil_completo, criado_em
          FROM users
          ORDER BY criado_em DESC
          LIMIT 20
        `;

    return rows.map((l) => {
      const role = normalizeRoleFromDb(l.papel as string);
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
    const [row] = await sql`
      SELECT
        id, apelido, nome, email, papel, banido, perfil_completo, criado_em,
        foto_url, localizacao, bio,
        entregues, reputacao, streak, nota,
        cargo, disputa_por, ano_eleicao,
        banido_em, motivo_banimento
      FROM users
      WHERE id = ${userId}
    `;
    if (!row) return null;

    const [countRow] = await sql`
      SELECT count(*)::int AS total
      FROM pautas
      WHERE reservada_por_id = ${userId}
        AND status IN ('reservada','oferecida','reedicao','em_revisao')
    `;

    const role = normalizeRoleFromDb(row.papel as string);

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
      // aliases
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

    const [updated] = await sql`
      UPDATE users
      SET banido = true,
          banido_em = now(),
          motivo_banimento = ${cleanReason},
          sessoes_validas_apos = now()
      WHERE id = ${userId} AND papel <> 'admin'
      RETURNING id
    `;
    if (updated) invalidateSessionRevocation(userId);
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
    const [updated] = await sql`
      UPDATE users
      SET banido = false,
          banido_em = null,
          motivo_banimento = null
      WHERE id = ${userId}
      RETURNING id
    `;
    if (!updated)
      return { ok: false, error: "Conta não encontrada.", erro: "Conta não encontrada." };
    return { ok: true };
  },

  async removeUser(userId: number) {
    const [target] = await sql`
      SELECT id, apelido, papel FROM users WHERE id = ${userId}
    `;
    if (!target)
      return { ok: false, error: "Conta não encontrada.", erro: "Conta não encontrada." };
    if (target.papel === "admin") {
      return {
        ok: false,
        error: "Conta de inspetor não pode ser apagada por aqui.",
        erro: "Conta de inspetor não pode ser apagada por aqui.",
      };
    }

    await sql`
      UPDATE pautas
      SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL, reservada_em = NULL
      WHERE reservada_por_id = ${userId} AND status IN ('reservada','reedicao','oferecida')
    `;

    await sql`DELETE FROM users WHERE id = ${userId}`;
    return { ok: true, handle: String(target.apelido), apelido: String(target.apelido) };
  },

  async reportsForInspector(): Promise<Report[]> {
    const rows = await sql`
      SELECT r.id, r.pauta_id, r.texto, r.status, r.criada_em,
             p.titulo AS pauta_titulo, p.status AS pauta_status,
             u1.nome AS denunciante_nome, u1.apelido AS denunciante_apelido, u1.id AS denunciante_id,
             u2.nome AS denunciado_nome, u2.apelido AS denunciado_apelido, u2.id AS denunciado_id
      FROM denuncias r
      JOIN pautas p ON p.id = r.pauta_id
      JOIN users u1 ON u1.id = r.denunciante_id
      LEFT JOIN users u2 ON u2.id = r.denunciado_id
      ORDER BY
        CASE WHEN r.status = 'aberta' THEN 0 ELSE 1 END,
        r.criada_em DESC
    `;
    return rows.map((r) => {
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
    const rows = await sql`
      UPDATE denuncias SET status = ${normStatus}, resolvida_em = now()
      WHERE id = ${id}
      RETURNING id
    `;
    if (rows.length === 0) {
      return { ok: false, error: "Denúncia não encontrada.", erro: "Denúncia não encontrada." };
    }
    return { ok: true };
  },

  async getSystemOverview(): Promise<SystemOverview> {
    const [p] = await sql`
      SELECT
        count(*) FILTER (WHERE status = 'disponivel')::int  AS na_fila,
        count(*) FILTER (WHERE status = 'oferecida')::int   AS oferecidas,
        count(*) FILTER (WHERE status = 'reservada')::int   AS em_edicao,
        count(*) FILTER (WHERE status = 'em_revisao')::int  AS em_conferencia,
        count(*) FILTER (WHERE status = 'reedicao')::int    AS em_reedicao,
        count(*) FILTER (WHERE status IN ('aprovada','finalizada'))::int AS concluidas
      FROM pautas
    `;

    const [u] = await sql`
      SELECT
        count(*) FILTER (WHERE papel IN ('voz', 'spokesperson') AND banido = false)::int    AS candidatos,
        count(*) FILTER (WHERE papel = 'editor' AND banido = false)::int                     AS editores,
        count(*) FILTER (WHERE banido = true)::int                                           AS banidos,
        count(*) FILTER (
          WHERE papel = 'editor' AND banido = false AND perfil_completo = true
            AND NOT EXISTS (
              SELECT 1 FROM pautas p
              WHERE p.reservada_por_id = users.id
                AND p.status IN ('reservada','em_revisao','reedicao')
            )
            AND NOT EXISTS (
              SELECT 1 FROM ofertas o WHERE o.editor_id = users.id AND o.status = 'pendente'
            )
        )::int AS editores_livres
      FROM users
    `;

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
    const rows = await sql`
      SELECT p.id, p.titulo, p.formato, p.criada_em, p.prioridade, p.status,
             v.nome AS candidato,
             e.apelido AS oferecida_para,
             o.oferecida_em
      FROM pautas p
      JOIN users v ON v.id = p.porta_voz_id
      LEFT JOIN ofertas o ON o.pauta_id = p.id AND o.status = 'pendente'
      LEFT JOIN users e ON e.id = o.editor_id
      WHERE p.status IN ('disponivel','oferecida')
      ORDER BY p.prioridade DESC, p.criada_em ASC
    `;
    return rows.map((l) => ({
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
    const rows = await sql`
      SELECT p.id, p.titulo, p.status, p.reservada_em, p.entrega_link,
             v.nome AS candidato, e.apelido AS editor
      FROM pautas p
      JOIN users v ON v.id = p.porta_voz_id
      LEFT JOIN users e ON e.id = p.reservada_por_id
      WHERE p.status IN ('reservada','em_revisao','reedicao')
      ORDER BY p.reservada_em ASC NULLS LAST
    `;
    return rows.map((l) => ({
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

  async moveInQueue(missionId, movement) {
    const queue = await sql`
      SELECT id FROM pautas
      WHERE status IN ('disponivel','oferecida')
      ORDER BY prioridade DESC, criada_em ASC
    `;
    const ids: number[] = queue.map((l) => Number(l.id));

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

    await sql`
      UPDATE pautas SET prioridade = v.prio
      FROM (
        SELECT unnest(${ids}::int[]) AS id,
               unnest(${priorities}::int[]) AS prio
      ) v
      WHERE pautas.id = v.id
    `;

    return { ok: true };
  },

  async getActiveEditorEmails() {
    const rows = await sql`
      SELECT nome, email FROM users
      WHERE papel = 'editor' AND banido = false
      ORDER BY nome ASC
    `;
    return rows.map((l) => ({
      name: String(l.nome),
      email: String(l.email),
      nome: String(l.nome),
    }));
  },

  async getActiveSpokespersonEmails() {
    const rows = await sql`
      SELECT nome, email FROM users
      WHERE papel IN ('voz', 'spokesperson') AND banido = false
      ORDER BY nome ASC
    `;
    return rows.map((l) => ({
      name: String(l.nome),
      email: String(l.email),
      nome: String(l.nome),
    }));
  },
};
