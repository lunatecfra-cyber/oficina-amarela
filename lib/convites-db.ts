import { createHash, randomBytes } from "node:crypto";
import { sql } from "@/lib/db";

const DIAS_VALIDADE = 7;

export function hashConvite(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function criarConvitePortaVoz(email: string, inspetorId: number) {
  const normalizado = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
    return { ok: false as const, erro: "Digite um e-mail válido." };
  }

  const token = randomBytes(32).toString("hex");
  await sql`
    UPDATE convites_porta_voz
    SET revogado_em = now(), revogado_por = ${inspetorId}
    WHERE lower(email) = lower(${normalizado}) AND usado_em IS NULL AND revogado_em IS NULL
  `;
  const [convite] = await sql`
    INSERT INTO convites_porta_voz (email, token_hash, criado_por, expira_em)
    VALUES (${normalizado}, ${hashConvite(token)}, ${inspetorId}, now() + (${DIAS_VALIDADE} || ' days')::interval)
    RETURNING id, email, expira_em
  `;
  await sql`
    INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
    VALUES (${inspetorId}, 'convite_criado', 'convite_porta_voz', ${String(convite.id)},
            ${sql.json({ email: normalizado })})
  `;
  return { ok: true as const, token, id: Number(convite.id), email: normalizado, expiraEm: convite.expira_em };
}

export async function listarConvitesPortaVoz() {
  return sql`
    SELECT c.id, c.email, c.criado_em, c.expira_em, c.usado_em, c.revogado_em,
           criador.nome AS criado_por_nome, usado.nome AS usado_por_nome,
           CASE
             WHEN c.revogado_em IS NOT NULL THEN 'revogado'
             WHEN c.usado_em IS NOT NULL THEN 'usado'
             WHEN c.expira_em <= now() THEN 'expirado'
             ELSE 'valido'
           END AS status
    FROM convites_porta_voz c
    JOIN users criador ON criador.id = c.criado_por
    LEFT JOIN users usado ON usado.id = c.usado_por
    ORDER BY c.criado_em DESC
  `;
}

export async function revogarConvitePortaVoz(id: number, inspetorId: number) {
  const [convite] = await sql`
    UPDATE convites_porta_voz
    SET revogado_em = now(), revogado_por = ${inspetorId}
    WHERE id = ${id} AND usado_em IS NULL AND revogado_em IS NULL
    RETURNING id, email
  `;
  if (!convite) return { ok: false as const, erro: "Convite não está disponível para revogação." };
  await sql`
    INSERT INTO auditoria_admin (ator_id, acao, entidade, entidade_id, detalhes)
    VALUES (${inspetorId}, 'convite_revogado', 'convite_porta_voz', ${String(id)},
            ${sql.json({ email: convite.email })})
  `;
  return { ok: true as const };
}

export async function validarConvitePortaVoz(token: string, email: string) {
  if (!token) return { ok: false as const, erro: "Convite especial obrigatório para porta-voz." };
  const [convite] = await sql`
    SELECT email, expira_em, usado_em, revogado_em
    FROM convites_porta_voz WHERE token_hash = ${hashConvite(token)}
  `;
  if (!convite) return { ok: false as const, erro: "Convite inválido." };
  if (String(convite.email).toLowerCase() !== email.trim().toLowerCase()) {
    return { ok: false as const, erro: "Este convite pertence a outro e-mail." };
  }
  if (convite.revogado_em) return { ok: false as const, erro: "Este convite foi revogado." };
  if (convite.usado_em) return { ok: false as const, erro: "Este convite já foi usado." };
  if (new Date(convite.expira_em).getTime() <= Date.now()) {
    return { ok: false as const, erro: "Este convite expirou." };
  }
  return { ok: true as const, tokenHash: hashConvite(token) };
}
