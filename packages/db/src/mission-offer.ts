import type { Mission } from "@oficina/domain/missions";
import type { PendingOffer } from "./mission-queue.ts";

export type MissionOfferRow = {
  id: number;
  titulo: string;
  formato: Mission["format"];
  status: Mission["status"];
  drive_link: string | null;
  youtube_link: string | null;
  brief_tom: string | null;
  brief_cor: string | null;
  brief_fonte: string | null;
  brief_refs: string | null;
  extras: string | null;
  motivo: string | null;
  prazo_desejado: string | null;
  criada_em: string;
  expira_em: string;
  ordem: number;
  porta_voz_nome: string;
  porta_voz_apelido: string;
};

export function pendingOfferFromRow(row: MissionOfferRow): PendingOffer {
  const deadline = row.prazo_desejado
    ? new Date(row.prazo_desejado).toISOString().slice(0, 10)
    : undefined;
  const createdAt = new Date(row.criada_em).toISOString();

  const mission: Mission = {
    id: `db-${row.id}`,
    spokesperson: row.porta_voz_nome,
    spokespersonHandle: row.porta_voz_apelido,
    title: row.titulo,
    format: row.formato,
    brief: {
      tone: row.brief_tom ?? undefined,
      color: row.brief_cor ?? undefined,
      font: row.brief_fonte ?? undefined,
      refs: row.brief_refs ?? undefined,
      tom: row.brief_tom ?? undefined,
      cor: row.brief_cor ?? undefined,
      fonte: row.brief_fonte ?? undefined,
    },
    status: row.status,
    createdAt,
    driveLink: row.drive_link ?? undefined,
    youtubeLink: row.youtube_link ?? undefined,
    extras: row.extras ?? undefined,
    motivation: row.motivo ?? undefined,
    desiredDeadline: deadline,
    portaVoz: row.porta_voz_nome,
    portaVozApelido: row.porta_voz_apelido,
    titulo: row.titulo,
    formato: row.formato,
    criadaEm: createdAt,
    motivo: row.motivo ?? undefined,
    prazoDesejado: deadline,
  };

  return {
    mission,
    expiresAt: new Date(row.expira_em).toISOString(),
    orderIndex: row.ordem,
  };
}
