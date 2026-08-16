// Pautas de verdade, no Postgres. Só roda em Node (Server Components e
// Route Handlers) — nunca importar isto de componente "use client".
//
// Por que banco e não localStorage: quem cria a pauta (porta-voz) e quem pega
// (editor) são pessoas diferentes, em navegadores diferentes. localStorage é
// isolado por navegador, então nunca chegaria de um pro outro.
import { sql } from "@/lib/db";
import { LIMITES, limitar, limitarOuNulo } from "@/lib/limites";
import type { Formato, Pauta, StatusPauta } from "@/lib/pautas";
import { pareceLink } from "@/lib/validators";

type LinhaPauta = {
  id: number;
  porta_voz_nome: string;
  porta_voz_apelido: string;
  titulo: string;
  formato: Formato;
  brief_tom: string | null;
  brief_cor: string | null;
  brief_fonte: string | null;
  brief_refs: string | null;
  drive_link: string | null;
  status: StatusPauta;
  reservada_por_apelido: string | null;
  reservada_ate: string | null;
  reservada_em: string | null;
  entrega_link: string | null;
  notas_inspetor: string | null;
  criada_em: string;
  extras: string | null;
  motivo: string | null;
  // coluna DATE: o driver devolve Date (meia-noite UTC), não string
  prazo_desejado: Date | string | null;
  reedicao_pedida_por: "inspetor" | "porta_voz" | null;
};

// converte a linha do banco pro mesmo formato que as telas já usam,
// assim nada de interface precisa ser reescrito
function paraPauta(l: LinhaPauta): Pauta {
  return {
    id: `db-${l.id}`,
    portaVoz: l.porta_voz_nome,
    portaVozApelido: l.porta_voz_apelido,
    titulo: l.titulo,
    formato: l.formato,
    brief: {
      tom: l.brief_tom ?? undefined,
      cor: l.brief_cor ?? undefined,
      fonte: l.brief_fonte ?? undefined,
      refs: l.brief_refs ?? undefined,
    },
    status: l.status,
    criadaEm: new Date(l.criada_em).toISOString(),
    reservadaPor: l.reservada_por_apelido ?? undefined,
    reservadaAte: l.reservada_ate ? new Date(l.reservada_ate).toISOString() : undefined,
    reservadaEm: l.reservada_em ? new Date(l.reservada_em).toISOString() : undefined,
    driveLink: l.drive_link ?? undefined,
    entregaLink: l.entrega_link ?? undefined,
    notasInspetor: l.notas_inspetor ?? undefined,
    extras: l.extras ?? undefined,
    motivo: l.motivo ?? undefined,
    // vira "AAAA-MM-DD" puro. O driver devolve Date na meia-noite UTC e, se
    // isso chegasse cru na tela, o toLocaleDateString em BRT (-3) mostraria
    // o dia ANTERIOR ao que o porta-voz escolheu.
    prazoDesejado: l.prazo_desejado
      ? new Date(l.prazo_desejado).toISOString().slice(0, 10)
      : undefined,
    reedicaoPedidaPor: l.reedicao_pedida_por ?? undefined,
  };
}

const SELECT_BASE = sql`
  SELECT p.id, u.nome AS porta_voz_nome, u.apelido AS porta_voz_apelido, p.titulo, p.formato,
         p.brief_tom, p.brief_cor, p.brief_fonte, p.brief_refs,
         p.drive_link, p.status, p.reservada_ate, p.reservada_em, p.entrega_link,
         p.notas_inspetor, p.criada_em,
         p.extras, p.motivo, p.prazo_desejado, p.reedicao_pedida_por,
         e.apelido AS reservada_por_apelido
  FROM pautas p
  JOIN users u ON u.id = p.porta_voz_id
  LEFT JOIN users e ON e.id = p.reservada_por_id
`;

export async function criarPauta(dados: {
  portaVozId: number;
  titulo: string;
  formato: Formato;
  driveLink?: string;
  tom?: string;
  cor?: string;
  fonte?: string;
  refs?: string;
  extras?: string;
  motivo?: string;
  prazo?: string;
}): Promise<{ ok: true; id: number } | { ok: false; erro: string }> {
  const titulo = limitar(dados.titulo, LIMITES.titulo);
  if (!titulo) return { ok: false, erro: "Dê um título pra missão." };
  if (dados.formato !== "short" && dados.formato !== "longo") {
    return { ok: false, erro: "Escolha o formato." };
  }

  // corta tudo aqui, no ponto onde grava: não importa se veio do wizard ou
  // de um POST direto na API
  const brief = {
    tom: limitarOuNulo(dados.tom, LIMITES.briefCampo),
    cor: limitarOuNulo(dados.cor, LIMITES.briefCampo),
    fonte: limitarOuNulo(dados.fonte, LIMITES.briefCampo),
    refs: limitarOuNulo(dados.refs, LIMITES.briefCampo),
    extras: limitarOuNulo(dados.extras, LIMITES.textoLongo),
    motivo: limitarOuNulo(dados.motivo, LIMITES.textoLongo),
    driveLink: limitarOuNulo(dados.driveLink, LIMITES.link),
    prazo: limitarOuNulo(dados.prazo, 10), // "AAAA-MM-DD"
  };

  const [linha] = await sql`
    INSERT INTO pautas (porta_voz_id, titulo, formato, drive_link,
                        brief_tom, brief_cor, brief_fonte, brief_refs,
                        extras, motivo, prazo_desejado)
    VALUES (${dados.portaVozId}, ${titulo}, ${dados.formato},
            ${brief.driveLink},
            ${brief.tom}, ${brief.cor},
            ${brief.fonte}, ${brief.refs},
            ${brief.extras},
            ${brief.motivo},
            ${brief.prazo})
    RETURNING id
  `;
  return { ok: true, id: linha.id };
}

/** As pautas de um porta-voz específico (a home dele). */
export async function pautasDoPortaVoz(portaVozId: number): Promise<Pauta[]> {
  const linhas = await sql`
    ${SELECT_BASE} WHERE p.porta_voz_id = ${portaVozId} ORDER BY p.criada_em DESC
  `;
  return (linhas as unknown as LinhaPauta[]).map(paraPauta);
}

/** Uma pauta de um porta-voz específico, pelo id.
 *  Filtra por porta_voz_id de propósito: o dono só pode ver a própria missão,
 *  nunca a de outro porta-voz (mesmo que adivinhe o id). */
export async function pautaPorIdDoPortaVoz(
  id: number,
  portaVozId: number
): Promise<Pauta | null> {
  const linhas = await sql`
    ${SELECT_BASE} WHERE p.id = ${id} AND p.porta_voz_id = ${portaVozId}
  `;
  const l = (linhas as unknown as LinhaPauta[])[0];
  return l ? paraPauta(l) : null;
}

/** Posição de uma pauta na fila dos editores (1 = primeira).
 *  Conta quantas pautas 'disponivel' foram criadas antes dela + 1. Só faz
 *  sentido pra pauta que ainda tá na fila; se já foi reservada, devolve 0. */
export async function posicaoNaFila(pautaId: number): Promise<number> {
  const [linha] = await sql`
    SELECT (
      SELECT COUNT(*)::int
      FROM pautas antes
      WHERE antes.status = 'disponivel'
        AND antes.criada_em <= p.criada_em
        AND antes.id <> p.id
    ) + 1 AS posicao,
    p.status
    FROM pautas p
    WHERE p.id = ${pautaId}
  `;
  if (!linha) return 0;
  return linha.status === "disponivel" ? linha.posicao : 0;
}

/** Total de pautas na fila dos editores agora (status 'disponivel'). */
export async function totalNaFila(): Promise<number> {
  const [linha] = await sql`
    SELECT COUNT(*)::int AS total FROM pautas WHERE status = 'disponivel'
  `;
  return linha?.total ?? 0;
}

/** Tudo que está livre pra qualquer editor pegar (a fila).
 *
 *  A ordem é a MESMA de `despacharMissoes` em lib/fila-db.ts. Se as duas
 *  divergirem, o inspetor sobe uma missão no Panorama, a lista mostra ela em
 *  primeiro e o despacho entrega outra — e ninguém entende o que aconteceu. */
export async function pautasDisponiveis(): Promise<Pauta[]> {
  const linhas = await sql`
    ${SELECT_BASE} WHERE p.status = 'disponivel'
    ORDER BY p.prioridade DESC, p.criada_em ASC
  `;
  return (linhas as unknown as LinhaPauta[]).map(paraPauta);
}

/** A pauta que este editor tem em mãos agora (regra: 1 por vez). */
export async function pautaReservadaPor(editorId: number): Promise<Pauta | null> {
  const linhas = await sql`
    ${SELECT_BASE}
    WHERE p.reservada_por_id = ${editorId}
      AND p.status IN ('reservada','em_revisao','reedicao')
    LIMIT 1
  `;
  const l = (linhas as unknown as LinhaPauta[])[0];
  return l ? paraPauta(l) : null;
}

/** Entregas já aprovadas de um editor — é o portfólio real dele.
 *  Inclui 'finalizada': depois que o porta-voz aceita, o trabalho continua
 *  sendo do editor. Sem isso o portfólio (e o match) esvaziaria sozinho. */
export async function entregasAprovadas(editorId: number): Promise<Pauta[]> {
  const linhas = await sql`
    ${SELECT_BASE}
    WHERE p.reservada_por_id = ${editorId} AND p.status IN ('aprovada','finalizada')
    ORDER BY p.criada_em DESC
  `;
  return (linhas as unknown as LinhaPauta[]).map(paraPauta);
}

/** Pautas de um porta-voz público (página /candidato/[slug]).
 *  Usa o apelido em vez do id porque a página pública não tem o userId. */
export async function pautasDoCandidatoPublico(apelido: string): Promise<Pauta[]> {
  const linhas = await sql`
    ${SELECT_BASE}
    WHERE lower(u.apelido) = lower(${apelido}) AND u.papel = 'voz' AND u.perfil_completo = true
    ORDER BY p.criada_em DESC
  `;
  return (linhas as unknown as LinhaPauta[]).map(paraPauta);
}

/** Tudo aguardando o controle de qualidade. */
export async function pautasEmRevisao(): Promise<Pauta[]> {
  const linhas = await sql`
    ${SELECT_BASE} WHERE p.status = 'em_revisao' ORDER BY p.criada_em ASC
  `;
  return (linhas as unknown as LinhaPauta[]).map(paraPauta);
}

/**
 * Reserva a pauta pro editor.
 *
 * O UPDATE só casa se a pauta ainda estiver 'disponivel'. Isso é a trava
 * contra dois editores pegarem a mesma pauta ao mesmo tempo: o banco
 * serializa, o segundo não encontra linha e recebe o erro.
 *
 * Sem prazo de entrega: a missão é do editor até entregar ou devolver.
 * O antigo `reservada_ate` (24h) vencia sem devolver nada — missão presa
 * com editor sumido. Gravamos só QUANDO pegou (`reservada_em`), que a
 * agenda usa pra mostrar "há quanto tempo está na mesa".
 */
export async function reservarPauta(
  pautaId: number,
  editorId: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const [travado] = await sql`
    SELECT travado_reservas_ate FROM users
    WHERE id = ${editorId} AND travado_reservas_ate > now()
  `;
  if (travado) return { ok: false, erro: "Você está temporariamente sem poder reservar." };

  const jaTem = await pautaReservadaPor(editorId);
  if (jaTem) {
    return { ok: false, erro: "Você já tem uma missão em mãos. Entregue antes de pegar outra." };
  }

  const linhas = await sql`
    UPDATE pautas
    SET status = 'reservada',
        reservada_por_id = ${editorId},
        reservada_em = now()
    WHERE id = ${pautaId} AND status = 'disponivel'
    RETURNING id
  `;
  if (linhas.length === 0) {
    return { ok: false, erro: "Essa missão já foi pega por outro editor." };
  }
  return { ok: true };
}

/** Devolve a pauta pra fila. */
export async function cancelarReserva(
  pautaId: number,
  editorId: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const linhas = await sql`
    UPDATE pautas
    SET status = 'disponivel', reservada_por_id = NULL, reservada_ate = NULL, reservada_em = NULL
    WHERE id = ${pautaId} AND reservada_por_id = ${editorId}
      AND status IN ('reservada','reedicao')
    RETURNING id
  `;
  if (linhas.length === 0) return { ok: false, erro: "Essa missão não está com você." };
  return { ok: true };
}

/** Editor manda o link do editado; vai pro controle de qualidade. */
export async function entregarPauta(
  pautaId: number,
  editorId: number,
  link: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  // Aceitava qualquer texto não-vazio. Duas coisas dependiam disso dar certo, e
  // nenhuma era nossa: o React recusa `javascript:` sozinho, e o navegador não
  // navega pra `data:text/html` — os dois testados, os dois barram. Mas quem
  // protegia era a biblioteca, não o código, e o `driveLink` logo ao lado já
  // conferia o formato na entrada. Aqui vale mais pelo produto do que pela
  // segurança: sem isso, o porta-voz recebia um "link" que não abria nada e só
  // descobria ao clicar. Agora o editor é avisado na hora de entregar.
  if (!pareceLink(link)) {
    return { ok: false, erro: "Cole o link do vídeo editado (começando com http)." };
  }

  const linhas = await sql`
    UPDATE pautas
    SET status = 'em_revisao', entrega_link = ${link.trim()}, notas_inspetor = NULL
    WHERE id = ${pautaId} AND reservada_por_id = ${editorId}
      AND status IN ('reservada','reedicao')
    RETURNING id
  `;
  if (linhas.length === 0) return { ok: false, erro: "Essa missão não está com você." };
  return { ok: true };
}

/**
 * Aprova a entrega. Este é o ponto em que os números do editor deixam de ser
 * enfeite: entregues sobe (e com ele o nível, que é coluna gerada), a nota
 * média é recalculada e o streak avança.
 */
export async function aprovarPauta(
  pautaId: number,
  nota?: number,
  comentario?: string,
  /**
   * Quem está aprovando, quando não é o inspetor.
   *
   * O porta-voz passou a poder aprovar a própria entrega, pra missão não ficar
   * parada esperando alguém do controle de qualidade aparecer. Isso abre duas
   * perguntas que o inspetor não tinha:
   *
   *  - de quem é a missão? O inspetor aprova qualquer uma; o porta-voz só a
   *    dele. Por isso o id vem por aqui e entra no WHERE.
   *  - e depois? Quando o próprio dono aprova, não faz sentido ele "aceitar a
   *    entrega" logo em seguida — ele acabou de aceitar. Então vai direto pra
   *    'finalizada', em vez de parar em 'aprovada' esperando um segundo
   *    clique dele mesmo.
   */
  portaVozId?: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const [pauta] = portaVozId
    ? await sql`
        SELECT reservada_por_id FROM pautas
        WHERE id = ${pautaId} AND status = 'em_revisao' AND porta_voz_id = ${portaVozId}
      `
    : await sql`
        SELECT reservada_por_id FROM pautas WHERE id = ${pautaId} AND status = 'em_revisao'
      `;
  if (!pauta?.reservada_por_id) return { ok: false, erro: "Essa missão não está em revisão." };
  const editorId = pauta.reservada_por_id as number;

  if (nota !== undefined && (nota < 1 || nota > 5)) {
    return { ok: false, erro: "A nota vai de 1 a 5." };
  }

  const statusFinal: StatusPauta = portaVozId ? "finalizada" : "aprovada";

  // O `AND pontuada = false` é a trava: depois que o porta-voz devolve uma
  // missão já aprovada pra reedição, o inspetor aprova a MESMA missão de novo.
  // Só a primeira aprovação pode valer ponto pro editor.
  const primeiraVez = await sql`
    UPDATE pautas
    SET status = ${statusFinal}, notas_inspetor = NULL, reedicao_pedida_por = NULL,
        pontuada = true
    WHERE id = ${pautaId} AND pontuada = false
    RETURNING id
  `;

  if (primeiraVez.length === 0) {
    // já pontuou antes: muda o status e para por aqui
    await sql`
      UPDATE pautas
      SET status = ${statusFinal}, notas_inspetor = NULL, reedicao_pedida_por = NULL
      WHERE id = ${pautaId}
    `;
    return { ok: true };
  }

  if (nota !== undefined) {
    await sql`
      INSERT INTO avaliacoes (pauta_id, editor_id, nota, comentario)
      VALUES (${pautaId}, ${editorId}, ${nota}, ${comentario?.trim() || null})
    `;
  }

  // entregues += 1 -> a coluna gerada "nivel" se atualiza sozinha
  await sql`
    UPDATE users
    SET entregues = entregues + 1,
        reputacao = reputacao + 25,
        streak = streak + 1
    WHERE id = ${editorId}
  `;

  // nota do editor = média das avaliações reais dele
  await sql`
    UPDATE users u
    SET nota = (SELECT ROUND(AVG(a.nota)::numeric, 2) FROM avaliacoes a WHERE a.editor_id = u.id)
    WHERE u.id = ${editorId}
  `;

  return { ok: true };
}

/** Controle de qualidade devolve pro editor com uma observação. */
export async function pedirReedicao(
  pautaId: number,
  notas: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!notas.trim()) return { ok: false, erro: "Escreva o que precisa mudar." };

  const linhas = await sql`
    UPDATE pautas SET status = 'reedicao', notas_inspetor = ${notas.trim()},
                      reedicao_pedida_por = 'inspetor'
    WHERE id = ${pautaId} AND status = 'em_revisao'
    RETURNING id
  `;
  if (linhas.length === 0) return { ok: false, erro: "Essa missão não está em revisão." };
  return { ok: true };
}

/**
 * O porta-voz aceita a entrega e fecha a missão.
 *
 * O filtro por porta_voz_id é de segurança, não de conveniência: sem ele
 * qualquer porta-voz logado fecharia a missão de outro só adivinhando o id.
 * Mesma trava de `pautaPorIdDoPortaVoz`.
 */
export async function aceitarEntrega(
  pautaId: number,
  portaVozId: number
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const linhas = await sql`
    UPDATE pautas SET status = 'finalizada'
    WHERE id = ${pautaId} AND porta_voz_id = ${portaVozId} AND status = 'aprovada'
    RETURNING id
  `;
  if (linhas.length === 0) {
    return { ok: false, erro: "Essa missão não está aguardando sua conferência." };
  }
  return { ok: true };
}

/**
 * O porta-voz viu o vídeo aprovado e quer um ajuste. Volta pras mãos do
 * mesmo editor, marcado como pedido dele (e não do inspetor).
 */
export async function pedirAjuste(
  pautaId: number,
  portaVozId: number,
  notas: string
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!notas.trim()) return { ok: false, erro: "Escreva o que precisa mudar." };

  const linhas = await sql`
    UPDATE pautas SET status = 'reedicao', notas_inspetor = ${notas.trim()},
                      reedicao_pedida_por = 'porta_voz'
    WHERE id = ${pautaId} AND porta_voz_id = ${portaVozId} AND status = 'aprovada'
    RETURNING id
  `;
  if (linhas.length === 0) {
    return { ok: false, erro: "Essa missão não está aguardando sua conferência." };
  }
  return { ok: true };
}

/**
 * Quem precisa ser avisado quando a missão muda de estado.
 *
 * Fica aqui, e não dentro de cada transição, por dois motivos: as funções de
 * transição já fazem o trabalho delas e não deviam saber o que é e-mail; e
 * assim quem dispara o aviso é a rota, que é onde existe a URL do site pra
 * montar o link de volta.
 */
export async function contatosDaPauta(pautaId: number): Promise<{
  titulo: string;
  portaVoz: { nome: string; email: string } | null;
  editor: { nome: string; email: string } | null;
} | null> {
  const [l] = await sql`
    SELECT p.titulo,
           v.nome AS voz_nome, v.email AS voz_email,
           e.nome AS ed_nome, e.email AS ed_email
    FROM pautas p
    JOIN users v ON v.id = p.porta_voz_id
    LEFT JOIN users e ON e.id = p.reservada_por_id
    WHERE p.id = ${pautaId}
  `;
  if (!l) return null;
  return {
    titulo: String(l.titulo),
    portaVoz: l.voz_email ? { nome: String(l.voz_nome), email: String(l.voz_email) } : null,
    editor: l.ed_email ? { nome: String(l.ed_nome), email: String(l.ed_email) } : null,
  };
}
