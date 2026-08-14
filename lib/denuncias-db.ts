// Denúncias — a reclamação que chega ao inspetor.
//
// A denúncia nasce DENTRO de uma missão e o acusado é DEDUZIDO: candidato
// denuncia → acusado é o editor que reservou; editor denuncia → acusado é o
// candidato dono. Quem reporta nunca escolhe o alvo — menos fricção e menos
// denúncia de pessoa errada. Quem decide o que fazer é o inspetor (banir,
// ignorar, resolver), no painel dele.
import { sql } from "@/lib/db";
import { LIMITES, limitar } from "@/lib/limites";
import type { SessaoUsuario } from "@/lib/sessao";

export type Denuncia = {
  id: number;
  pautaId: number;
  pautaTitulo: string;
  pautaStatus: string;
  denuncianteId: number;
  denuncianteNome: string;
  denuncianteApelido: string;
  denunciadoId: number | null;
  denunciadoNome: string | null;
  denunciadoApelido: string | null;
  texto: string;
  status: "aberta" | "resolvida" | "ignorada";
  criadaEm: string;
};

export async function criarDenuncia(
  pautaId: number,
  sessao: SessaoUsuario,
  textoBruto: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const texto = limitar(textoBruto, LIMITES.denuncia);
  if (!texto) return { ok: false, erro: "Descreva o problema antes de denunciar." };
  if (sessao.papel === "admin") {
    return { ok: false, erro: "O inspetor não denuncia — ele resolve." };
  }

  const [pauta] = await sql`
    SELECT porta_voz_id, reservada_por_id FROM pautas WHERE id = ${pautaId}
  `;
  if (!pauta) return { ok: false, erro: "Missão não encontrada." };

  // dedução do acusado: quem reporta aponta pro OUTRO lado da missão
  let denunciadoId: number | null = null;
  if (pauta.porta_voz_id === sessao.id) {
    denunciadoId = pauta.reservada_por_id ?? null; // candidato → editor (se houver)
  } else if (pauta.reservada_por_id === sessao.id) {
    denunciadoId = pauta.porta_voz_id; // editor → candidato
  } else {
    return { ok: false, erro: "Só quem participa da missão pode denunciá-la." };
  }

  await sql`
    INSERT INTO denuncias (pauta_id, denunciante_id, denunciado_id, texto)
    VALUES (${pautaId}, ${sessao.id}, ${denunciadoId}, ${texto})
  `;
  return { ok: true };
}

/** Lista pro painel do inspetor: abertas primeiro, novas no topo. */
export async function denunciasParaInspetor(): Promise<Denuncia[]> {
  const linhas = await sql`
    SELECT d.id, d.texto, d.status, d.criada_em,
           d.denunciante_id, d.denunciado_id,
           p.id AS pauta_id, p.titulo AS pauta_titulo, p.status AS pauta_status,
           den.nome AS denunciante_nome, den.apelido AS denunciante_apelido,
           ado.nome AS denunciado_nome, ado.apelido AS denunciado_apelido
    FROM denuncias d
    JOIN pautas p ON p.id = d.pauta_id
    JOIN users den ON den.id = d.denunciante_id
    LEFT JOIN users ado ON ado.id = d.denunciado_id
    ORDER BY
      CASE d.status WHEN 'aberta' THEN 0 ELSE 1 END,
      d.criada_em DESC
    LIMIT 100
  `;
  return (linhas as unknown as (Record<string, never> & { [k: string]: unknown })[]).map((l) => ({
    id: l.id as number,
    pautaId: l.pauta_id as number,
    pautaTitulo: l.pauta_titulo as string,
    pautaStatus: l.pauta_status as string,
    denuncianteId: l.denunciante_id as number,
    denuncianteNome: l.denunciante_nome as string,
    denuncianteApelido: l.denunciante_apelido as string,
    denunciadoId: (l.denunciado_id as number | null) ?? null,
    denunciadoNome: (l.denunciado_nome as string | null) ?? null,
    denunciadoApelido: (l.denunciado_apelido as string | null) ?? null,
    texto: l.texto as string,
    status: l.status as Denuncia["status"],
    criadaEm: l.criada_em as string,
  }));
}

/** Inspetor fecha o ciclo: marcar resolvida ou ignorar. */
export async function resolverDenuncia(
  denunciaId: number,
  acao: "resolver" | "ignorar"
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const novoStatus = acao === "resolver" ? "resolvida" : "ignorada";
  const [atualizada] = await sql`
    UPDATE denuncias
    SET status = ${novoStatus}, resolvida_em = now()
    WHERE id = ${denunciaId} AND status = 'aberta'
    RETURNING id
  `;
  if (!atualizada) {
    return { ok: false, erro: "Denúncia não encontrada ou já fechada." };
  }
  return { ok: true };
}
