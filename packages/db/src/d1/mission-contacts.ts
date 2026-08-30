import type { MissionContacts } from "../mission-contacts.ts";
import type { D1DatabaseLike } from "./types.ts";

/** Paridade D1 de quem precisa ser avisado sobre uma missão. */
export function createD1MissionContacts(db: D1DatabaseLike) {
  return async function missionContacts(missionId: number): Promise<MissionContacts | null> {
    const row = await db
      .prepare(
        `SELECT p.titulo,
                v.nome AS voz_nome, v.email AS voz_email,
                e.nome AS ed_nome, e.email AS ed_email
         FROM pautas p
         JOIN users v ON v.id = p.porta_voz_id
         LEFT JOIN users e ON e.id = p.reservada_por_id
         WHERE p.id = ?`,
      )
      .bind(missionId)
      .first<{
        titulo: string;
        voz_nome: string | null;
        voz_email: string | null;
        ed_nome: string | null;
        ed_email: string | null;
      }>();
    if (!row) return null;

    return {
      title: String(row.titulo),
      spokesperson: row.voz_email
        ? { name: String(row.voz_nome), email: String(row.voz_email) }
        : null,
      editor: row.ed_email ? { name: String(row.ed_nome), email: String(row.ed_email) } : null,
    };
  };
}
