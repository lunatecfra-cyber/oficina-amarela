import type { Mission } from "@oficina/domain/missions";
import type { PendingOffer } from "./mission-queue.ts";

export type MissionOfferRow = {
  id: number;
  title?: string;
  format?: Mission["format"];
  status: Mission["status"];
  drive_link?: string | null;
  youtube_link?: string | null;
  brief_tone?: string | null;
  brief_color?: string | null;
  brief_font?: string | null;
  brief_refs?: string | null;
  extras?: string | null;
  motivation?: string | null;
  desired_deadline?: string | null;
  created_at?: string;
  expires_at?: string;
  position?: number;
  order_index?: number;
  spokesperson_name?: string;
  spokesperson_handle?: string;

  // legacy:
  titulo?: string;
  formato?: Mission["format"];
  brief_tom?: string | null;
  brief_cor?: string | null;
  brief_fonte?: string | null;
  motivo?: string | null;
  prazo_desejado?: string | null;
  criada_em?: string;
  expira_em?: string;
  ordem?: number;
  porta_voz_nome?: string;
  porta_voz_apelido?: string;
};

export function pendingOfferFromRow(row: MissionOfferRow): PendingOffer {
  const rawDeadline = row.desired_deadline ?? row.prazo_desejado;
  const deadline = rawDeadline ? new Date(rawDeadline).toISOString().slice(0, 10) : undefined;
  const createdAt = new Date(row.created_at ?? row.criada_em ?? Date.now()).toISOString();
  const spName = row.spokesperson_name ?? row.porta_voz_nome ?? "";
  const spHandle = row.spokesperson_handle ?? row.porta_voz_apelido ?? "";
  const title = row.title ?? row.titulo ?? "";
  const format = row.format ?? row.formato ?? "short";
  const tone = row.brief_tone ?? row.brief_tom ?? undefined;
  const color = row.brief_color ?? row.brief_cor ?? undefined;
  const font = row.brief_font ?? row.brief_fonte ?? undefined;
  const refs = row.brief_refs ?? undefined;
  const motivation = row.motivation ?? row.motivo ?? undefined;

  const mission: Mission = {
    id: `db-${row.id}`,
    spokesperson: spName,
    spokespersonHandle: spHandle,
    title,
    format,
    brief: {
      tone,
      color,
      font,
      refs,
      tom: tone,
      cor: color,
      fonte: font,
    },
    status: row.status,
    createdAt,
    driveLink: row.drive_link ?? undefined,
    youtubeLink: row.youtube_link ?? undefined,
    extras: row.extras ?? undefined,
    motivation,
    desiredDeadline: deadline,
    portaVoz: spName,
    portaVozApelido: spHandle,
    titulo: title,
    formato: format,
    criadaEm: createdAt,
    motivo: motivation,
    prazoDesejado: deadline,
  };

  return {
    mission,
    expiresAt: new Date(row.expires_at ?? row.expira_em ?? Date.now()).toISOString(),
    orderIndex: row.position ?? row.order_index ?? row.ordem ?? 0,
  };
}
