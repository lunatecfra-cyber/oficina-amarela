import type { MissionContacts } from "../mission-contacts.ts";
import type { D1DatabaseLike } from "./types.ts";

/** Paridade D1 de quem precisa ser avisado sobre uma missão. */
export function createD1MissionContacts(db: D1DatabaseLike) {
  return async function missionContacts(missionId: number): Promise<MissionContacts | null> {
    const row = await db
      .prepare(
        `SELECT p.title,
                v.name AS spokesperson_name, v.email AS spokesperson_email,
                e.name AS editor_name, e.email AS editor_email
         FROM missions p
         JOIN users v ON v.id = p.spokesperson_id
         LEFT JOIN users e ON e.id = p.reserved_by_id
         WHERE p.id = ?`,
      )
      .bind(missionId)
      .first<{
        title?: string;
        spokesperson_name?: string | null;
        spokesperson_email?: string | null;
        editor_name?: string | null;
        editor_email?: string | null;
        titulo?: string;
        voz_nome?: string | null;
        voz_email?: string | null;
        ed_nome?: string | null;
        ed_email?: string | null;
      }>();
    if (!row) return null;

    const title = row.title ?? row.titulo ?? "";
    const spEmail = row.spokesperson_email ?? row.voz_email;
    const spName = row.spokesperson_name ?? row.voz_nome;
    const edEmail = row.editor_email ?? row.ed_email;
    const edName = row.editor_name ?? row.ed_nome;

    return {
      title: String(title),
      spokesperson: spEmail ? { name: String(spName), email: String(spEmail) } : null,
      editor: edEmail ? { name: String(edName), email: String(edEmail) } : null,
    };
  };
}
