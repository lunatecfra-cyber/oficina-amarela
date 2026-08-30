import { sql } from "./client.ts";

export type MissionContacts = {
  title: string;
  spokesperson: { name: string; email: string } | null;
  editor: { name: string; email: string } | null;
};

/** Quem precisa ser avisado sobre uma missão, e o título que vai no aviso. */
export async function missionContacts(missionId: number): Promise<MissionContacts | null> {
  const [row] = await sql`
    SELECT p.titulo,
           v.nome AS voz_nome, v.email AS voz_email,
           e.nome AS ed_nome, e.email AS ed_email
    FROM pautas p
    JOIN users v ON v.id = p.porta_voz_id
    LEFT JOIN users e ON e.id = p.reservada_por_id
    WHERE p.id = ${missionId}
  `;
  if (!row) return null;

  return {
    title: String(row.titulo),
    spokesperson: row.voz_email
      ? { name: String(row.voz_nome), email: String(row.voz_email) }
      : null,
    editor: row.ed_email ? { name: String(row.ed_nome), email: String(row.ed_email) } : null,
  };
}
