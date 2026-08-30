import type { Role } from "@oficina/domain/roles";
import { type TransactionSql, withTransaction } from "./client.ts";

export type MissionApprovalFailure =
  | "mission_not_found"
  | "mission_not_in_review"
  | "forbidden"
  | "invalid_rating";

export type MissionApprovalResult =
  | { ok: true; editorId: number; scored: boolean; referralAwarded: boolean }
  | { ok: false; reason: MissionApprovalFailure };

export type ApproveMissionInput = {
  missionId: number;
  actor: { id: number; role: Role };
  rating?: number;
  comment?: string;
};

export interface MissionApprovalRepository {
  approveMission(input: ApproveMissionInput): Promise<MissionApprovalResult>;
}

type MissionRow = {
  porta_voz_id: number;
  reservada_por_id: number | null;
  status: string;
  pontuada: boolean;
};

async function awardReferral(transaction: TransactionSql, editorId: number): Promise<boolean> {
  const [reward] = await transaction`
    WITH dados AS (
      SELECT u.indicado_por_id AS convidador_id,
             (SELECT count(*) FROM ranking_aprovacoes a
              WHERE a.editor_id = u.id AND a.anulado_em IS NULL) AS aprovacoes
      FROM users u WHERE u.id = ${editorId}
    ), elegivel AS (
      SELECT convidador_id FROM dados
      WHERE convidador_id IS NOT NULL AND aprovacoes >= 2
        AND (SELECT count(*) FROM indicacoes_recompensas r
             WHERE r.convidador_id = dados.convidador_id
               AND r.revogado_em IS NULL
               AND r.premiado_em >= date_trunc('month', now())) < 5
    ), inserida AS (
      INSERT INTO indicacoes_recompensas (convidado_id, convidador_id)
      SELECT ${editorId}, convidador_id FROM elegivel
      ON CONFLICT (convidado_id) DO NOTHING
      RETURNING convidador_id, pontos
    )
    UPDATE users u SET reputacao = u.reputacao + inserida.pontos
    FROM inserida WHERE u.id = inserida.convidador_id
    RETURNING u.id
  `;
  return Boolean(reward);
}

export const postgresMissionApproval: MissionApprovalRepository = {
  async approveMission(input) {
    if (
      input.rating !== undefined &&
      (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    ) {
      return { ok: false, reason: "invalid_rating" };
    }
    if (input.actor.role !== "admin" && input.actor.role !== "spokesperson") {
      return { ok: false, reason: "forbidden" };
    }

    return withTransaction(async (transaction) => {
      const [mission] = (await transaction`
        SELECT porta_voz_id, reservada_por_id, status, pontuada
        FROM pautas WHERE id = ${input.missionId}
        FOR UPDATE
      `) as unknown as MissionRow[];
      if (!mission) return { ok: false, reason: "mission_not_found" };
      if (input.actor.role === "spokesperson" && mission.porta_voz_id !== input.actor.id) {
        return { ok: false, reason: "forbidden" };
      }
      if (!mission.reservada_por_id) {
        return { ok: false, reason: "mission_not_in_review" };
      }

      const finalStatus = input.actor.role === "admin" ? "aprovada" : "finalizada";
      if (mission.status !== "em_revisao") {
        return mission.status === finalStatus && mission.pontuada
          ? {
              ok: true,
              editorId: mission.reservada_por_id,
              scored: false,
              referralAwarded: false,
            }
          : { ok: false, reason: "mission_not_in_review" };
      }

      await transaction`
        UPDATE pautas
        SET status = ${finalStatus}, notas_inspetor = NULL,
            reedicao_pedida_por = NULL, pontuada = true
        WHERE id = ${input.missionId}
      `;
      if (mission.pontuada) {
        return {
          ok: true,
          editorId: mission.reservada_por_id,
          scored: false,
          referralAwarded: false,
        };
      }

      if (input.rating !== undefined) {
        await transaction`
          INSERT INTO avaliacoes (pauta_id, editor_id, nota, comentario)
          VALUES (
            ${input.missionId}, ${mission.reservada_por_id}, ${input.rating},
            ${input.comment?.trim() || null}
          )
        `;
      }
      await transaction`
        UPDATE users
        SET entregues = entregues + 1, reputacao = reputacao + 25, streak = streak + 1
        WHERE id = ${mission.reservada_por_id}
      `;
      await transaction`
        UPDATE users u
        SET nota = (
          SELECT round(avg(a.nota)::numeric, 2) FROM avaliacoes a WHERE a.editor_id = u.id
        )
        WHERE u.id = ${mission.reservada_por_id}
      `;
      await transaction`
        INSERT INTO ranking_aprovacoes (pauta_id, ciclo_id, editor_id, aprovado_por)
        SELECT ${input.missionId}, c.id, ${mission.reservada_por_id}, ${input.actor.id}
        FROM ranking_ciclos c
        WHERE c.congelado_em IS NULL AND now() BETWEEN c.inicia_em AND c.termina_em
        ORDER BY c.inicia_em DESC LIMIT 1
        ON CONFLICT (pauta_id) DO UPDATE SET
          ciclo_id = EXCLUDED.ciclo_id,
          editor_id = EXCLUDED.editor_id,
          aprovado_por = EXCLUDED.aprovado_por,
          aprovado_em = now(),
          anulado_em = NULL,
          anulado_por = NULL,
          motivo_anulacao = NULL
        WHERE ranking_aprovacoes.anulado_em IS NOT NULL
      `;
      await transaction`
        INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
        VALUES (
          ${input.actor.id}, 'edicao_aprovada', 'pauta', ${String(input.missionId)},
          ${transaction.json({ editorId: mission.reservada_por_id })}
        )
      `;
      const referralAwarded = await awardReferral(transaction, mission.reservada_por_id);
      return {
        ok: true,
        editorId: mission.reservada_por_id,
        scored: true,
        referralAwarded,
      };
    });
  },
};
