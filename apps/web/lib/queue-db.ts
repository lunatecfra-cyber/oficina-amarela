import type { Mission } from "@oficina/domain/missions";
import {
  ACTIVE_MISSION_PER_EDITOR_INDEX,
  isUniqueViolation,
  OFFER_UNIQUE_INDEXES,
  sql,
} from "@/lib/db";

export const OFFER_MINUTES = 5;
export const MINUTOS_OFERTA = OFFER_MINUTES;

const PRESENCE_MINUTES = 3;

// A janela de presença é de 3 minutos; gravar a cada poll (15s) é 4x mais
// escrita do que a decisão precisa. 60s mantém a granularidade útil e corta as
// escritas mais caras do caminho quente.
const PRESENCE_WRITE_SECONDS = 60;

export type Offer = {
  mission: Mission;
  expiresAt: string;
  orderIndex: number;
  // compatibility aliases
  pauta?: Mission;
  expiraEm?: string;
  ordem?: number;
};

export type Oferta = Offer;

function invalidOffer(): { ok: false; error: string; erro: string } {
  return {
    ok: false,
    error: "Essa oferta não é mais válida.",
    erro: "Essa oferta não é mais válida.",
  };
}

export async function markEditorActive(editorId: number): Promise<void> {
  await sql`
    UPDATE users SET ultimo_visto_em = now()
    WHERE id = ${editorId}
      AND (
        ultimo_visto_em IS NULL
        OR ultimo_visto_em < now() - make_interval(secs => ${PRESENCE_WRITE_SECONDS})
      )
  `;
}

export const marcarEditorAtivo = markEditorActive;

export async function expireTimedOutOffers(): Promise<number> {
  const expired = await sql`
    UPDATE ofertas o
    SET status = 'expirada', respondida_em = now()
    FROM users u
    WHERE o.status = 'pendente'
      AND (
        o.oferecida_em <= now() - (${OFFER_MINUTES} || ' minutes')::interval
        OR
        (o.editor_id = u.id AND u.ultimo_visto_em <= now() - interval '3 minutes')
      )
    RETURNING o.pauta_id
  `;
  if (expired.length === 0) return 0;

  const ids = expired.map((v) => v.pauta_id as number);
  await sql`
    UPDATE pautas SET status = 'disponivel'
    WHERE id = ANY(${ids}) AND status = 'oferecida'
  `;
  return expired.length;
}

export const expirarOfertasVencidas = expireTimedOutOffers;

async function getNextEditor(missionId: number, spokespersonId: number): Promise<number | null> {
  const [row] = await sql`
    WITH agora AS (
      SELECT
        (EXTRACT(DOW FROM now() AT TIME ZONE 'America/Sao_Paulo')::int + 6) % 7 AS dia,
        CASE
          WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 6 AND 11 THEN 0
          WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 12 AND 17 THEN 1
          ELSE 2
        END AS periodo
    )
    SELECT u.id
    FROM users u, agora a
    WHERE u.papel = 'editor'
      AND u.ultimo_visto_em > now() - (${PRESENCE_MINUTES} || ' minutes')::interval
      AND (u.travado_reservas_ate IS NULL OR u.travado_reservas_ate <= now())
      AND (
        u.disponibilidade IS NULL
        OR u.disponibilidade -> a.periodo -> a.dia IS NULL
        OR (u.disponibilidade -> a.periodo ->> a.dia) = 'true'
      )
      AND NOT EXISTS (
        SELECT 1 FROM pautas p
        WHERE p.reservada_por_id = u.id
          AND p.status IN ('reservada','em_revisao','reedicao')
      )
      AND NOT EXISTS (
        SELECT 1 FROM ofertas o WHERE o.editor_id = u.id AND o.status = 'pendente'
      )
      AND NOT EXISTS (
        SELECT 1 FROM ofertas o WHERE o.editor_id = u.id AND o.pauta_id = ${missionId}
      )
    ORDER BY
      (SELECT COUNT(*) FROM pautas h
       WHERE h.reservada_por_id = u.id
         AND h.porta_voz_id = ${spokespersonId}
         AND h.status IN ('aprovada','finalizada')) DESC,
      u.entregues DESC,
      u.ultimo_visto_em ASC
    LIMIT 1
  `;
  return row?.id ?? null;
}

export async function dispatchMissions(): Promise<number> {
  const pending = await sql`
    SELECT id, porta_voz_id FROM pautas
    WHERE status = 'disponivel'
    ORDER BY prioridade DESC, criada_em ASC
    LIMIT 20
  `;

  let dispatched = 0;
  for (const p of pending) {
    const editorId = await getNextEditor(p.id, p.porta_voz_id);
    if (!editorId) continue;

    try {
      // Um único comando: ou a missão sai de 'disponivel' E a oferta nasce, ou
      // nada acontece. Separado em dois, uma falha entre eles deixava oferta
      // pendente numa missão que outro editor ainda podia reservar direto.
      const created = await sql`
        WITH claimed AS (
          UPDATE pautas SET status = 'oferecida'
          WHERE id = ${p.id} AND status = 'disponivel'
          RETURNING id
        )
        INSERT INTO ofertas (pauta_id, editor_id, expira_em, ordem)
        SELECT c.id, ${editorId},
               now() + (${OFFER_MINUTES} || ' minutes')::interval,
               (SELECT COALESCE(MAX(o.ordem), 0) + 1 FROM ofertas o WHERE o.pauta_id = c.id)
        FROM claimed c
        RETURNING id
      `;
      if (created.length > 0) dispatched++;
    } catch (e) {
      // Alguma invariante de oferta barrou o par (missão, editor): já viu essa
      // missão, já tem oferta viva, ou a missão já tem uma. O comando inteiro
      // reverte, então a missão continua 'disponivel' pro próximo.
      if (!OFFER_UNIQUE_INDEXES.some((index) => isUniqueViolation(e, index))) throw e;
    }
  }
  return dispatched;
}

export const despacharMissoes = dispatchMissions;

export async function getPendingOffer(editorId: number): Promise<Offer | null> {
  const [l] = await sql`
    SELECT o.expira_em, o.ordem,
           p.id, p.titulo, p.formato, p.drive_link, p.youtube_link, p.status,
           p.brief_tom, p.brief_cor, p.brief_fonte, p.brief_refs,
           p.extras, p.motivo, p.prazo_desejado, p.criada_em,
           u.nome AS porta_voz_nome, u.apelido AS porta_voz_apelido
    FROM ofertas o
    JOIN pautas p ON p.id = o.pauta_id
    JOIN users u ON u.id = p.porta_voz_id
    WHERE o.editor_id = ${editorId} AND o.status = 'pendente' AND o.expira_em > now()
    LIMIT 1
  `;
  if (!l) return null;

  const missionObj: Mission = {
    id: `db-${l.id}`,
    spokesperson: l.porta_voz_nome,
    spokespersonHandle: l.porta_voz_apelido,
    title: l.titulo,
    format: l.formato,
    brief: {
      tone: l.brief_tom ?? undefined,
      color: l.brief_cor ?? undefined,
      font: l.brief_fonte ?? undefined,
      refs: l.brief_refs ?? undefined,
      tom: l.brief_tom ?? undefined,
      cor: l.brief_cor ?? undefined,
      fonte: l.brief_fonte ?? undefined,
    },
    status: l.status,
    createdAt: new Date(l.criada_em).toISOString(),
    driveLink: l.drive_link ?? undefined,
    youtubeLink: l.youtube_link ?? undefined,
    extras: l.extras ?? undefined,
    motivation: l.motivo ?? undefined,
    desiredDeadline: l.prazo_desejado
      ? new Date(l.prazo_desejado).toISOString().slice(0, 10)
      : undefined,
    // aliases
    portaVoz: l.porta_voz_nome,
    portaVozApelido: l.porta_voz_apelido,
    titulo: l.titulo,
    formato: l.formato,
    criadaEm: new Date(l.criada_em).toISOString(),
    motivo: l.motivo ?? undefined,
    prazoDesejado: l.prazo_desejado
      ? new Date(l.prazo_desejado).toISOString().slice(0, 10)
      : undefined,
  };

  return {
    expiresAt: new Date(l.expira_em).toISOString(),
    orderIndex: l.ordem,
    mission: missionObj,
    expiraEm: new Date(l.expira_em).toISOString(),
    ordem: l.ordem,
    pauta: missionObj,
  };
}

export const ofertaPendente = getPendingOffer;

export async function acceptOffer(
  missionId: number,
  editorId: number,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  // A reserva vem primeiro, condicionada a existir oferta viva: assim `ok: true`
  // só sai quando o editor realmente ficou com a missão. Na ordem inversa, a
  // oferta era consumida mesmo quando a missão já tinha voltado pra fila.
  let reserved: readonly unknown[];
  try {
    reserved = await sql`
      UPDATE pautas AS p
      SET status = 'reservada',
          reservada_por_id = ${editorId},
          reservada_em = now()
      WHERE p.id = ${missionId}
        AND p.status = 'oferecida'
        AND EXISTS (
          SELECT 1 FROM ofertas o
          WHERE o.pauta_id = p.id AND o.editor_id = ${editorId}
            AND o.status = 'pendente' AND o.expira_em > now()
        )
      RETURNING p.id
    `;
  } catch (error) {
    if (isUniqueViolation(error, ACTIVE_MISSION_PER_EDITOR_INDEX)) {
      return {
        ok: false,
        error: "Você já tem uma missão em mãos.",
        erro: "Você já tem uma missão em mãos.",
      };
    }
    throw error;
  }

  if (reserved.length === 0) return invalidOffer();

  // Se cair aqui, a missão já é do editor. A oferta pendente que sobrar expira
  // sozinha em OFFER_MINUTES e não devolve a missão pra fila (o sweep só mexe
  // em status 'oferecida').
  await sql`
    UPDATE ofertas SET status = 'aceita', respondida_em = now()
    WHERE pauta_id = ${missionId} AND editor_id = ${editorId} AND status = 'pendente'
  `;

  return { ok: true };
}

export const aceitarOferta = acceptOffer;

export async function rejectOffer(
  missionId: number,
  editorId: number,
): Promise<{ ok: true } | { ok: false; error: string; erro?: string }> {
  // Recusar e devolver a missão pra fila no mesmo comando: separados, uma falha
  // entre eles deixava a missão presa em 'oferecida' sem oferta pendente, e o
  // sweep de expiração não a resgatava (ele só olha ofertas pendentes).
  const declined = await sql`
    WITH declined AS (
      UPDATE ofertas SET status = 'rejeitada', respondida_em = now()
      WHERE pauta_id = ${missionId} AND editor_id = ${editorId} AND status = 'pendente'
      RETURNING pauta_id
    ), released AS (
      UPDATE pautas SET status = 'disponivel'
      WHERE id IN (SELECT pauta_id FROM declined) AND status = 'oferecida'
      RETURNING id
    )
    SELECT pauta_id FROM declined
  `;
  if (declined.length === 0) return invalidOffer();

  return { ok: true };
}

export const recusarOferta = rejectOffer;

export async function getOnlineEditorsCount(): Promise<number> {
  const [l] = await sql`
    SELECT COUNT(*)::int AS total FROM users
    WHERE papel = 'editor'
      AND ultimo_visto_em > now() - (${PRESENCE_MINUTES} || ' minutes')::interval
  `;
  return l?.total ?? 0;
}

export const editoresOnline = getOnlineEditorsCount;

export const acceptMissionOffer = acceptOffer;
export const declineMissionOffer = rejectOffer;
export const expireStaleOffers = expireTimedOutOffers;
export const pendingOfferForEditor = getPendingOffer;
