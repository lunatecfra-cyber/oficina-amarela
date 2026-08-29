import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import {
  aceitarEntrega,
  aprovarPauta,
  cancelarReserva,
  contatosDaPauta,
  entregarPauta,
  pedirAjuste,
  pedirReedicao,
  reservarPauta,
} from "@/lib/pautas-db";
import {
  avisarEntregaAprovada,
  avisarEntregaPronta,
  avisarReedicaoPedida,
} from "@/lib/email";
import { enviarMensagem, mensagensDaPauta, mensagensDaPautaApos } from "@/lib/chat-db";
import { criarDenuncia } from "@/lib/denuncias-db";
import { lerSessao } from "@/lib/sessao-servidor";
import { podeExecutarAcao } from "@/lib/transicoes-pauta";
import { registrarEventoGamificacao } from "@/lib/gamificacao-db";

// GET — polling do chat. Retorna mensagens de uma missão, opcionalmente
// só as que vieram depois de ?depois=<ISO timestamp>.
//
// Acesso: mesma regra do chat — dono da pauta, editor que reservou, ou admin.
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });

  const { id } = await ctx.params;
  const pautaId = Number(String(id).replace(/^db-/, ""));
  if (!Number.isInteger(pautaId)) {
    return NextResponse.json({ erro: "Missão inválida." }, { status: 400 });
  }

  // checa vínculo — mesmo critério de enviarMensagem
  const [pauta] = await sql`
    SELECT porta_voz_id, reservada_por_id FROM pautas WHERE id = ${pautaId}
  `;
  if (!pauta) return NextResponse.json({ erro: "Missão não encontrada." }, { status: 404 });

  const ehDono = pauta.porta_voz_id === sessao.id;
  const ehEditorDaMissao = pauta.reservada_por_id === sessao.id;
  if (!ehDono && !ehEditorDaMissao && sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Sem acesso a esta missão." }, { status: 403 });
  }

  const url = new URL(request.url);
  const depois = url.searchParams.get("depois");
  const mensagens = depois
    ? await mensagensDaPautaApos(pautaId, depois)
    : await mensagensDaPauta(pautaId);

  return NextResponse.json({ mensagens });
}

// Uma rota só pra todas as transições da pauta, escolhida por "acao".
// Mantém o ciclo inteiro em um lugar: reservar -> entregar -> aprovar/reedicao.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });

  const { id } = await ctx.params;
  // as pautas de demonstração usam id tipo "p1"; só as do banco são numéricas
  const pautaId = Number(String(id).replace(/^db-/, ""));
  if (!Number.isInteger(pautaId)) {
    return NextResponse.json({ erro: "Essa é uma missão de demonstração." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const acao = body?.acao;

  const [pautaAtual] = await sql`
    SELECT status FROM pautas WHERE id = ${pautaId}
  `;
  if (!pautaAtual) return NextResponse.json({ erro: "Missão não encontrada." }, { status: 404 });
  if (!podeExecutarAcao(String(pautaAtual.status), sessao.papel, String(acao))) {
    return NextResponse.json({ erro: "Essa ação não combina com o estado atual da missão." }, { status: 409 });
  }

  const ehEditor = sessao.papel === "editor" || sessao.papel === "admin";
  const ehQualidade = sessao.papel === "admin"; // controle de qualidade hoje é só admin
  const ehPortaVoz = sessao.papel === "voz" || sessao.papel === "admin";

  let r: { ok: true } | { ok: false; erro: string };

  switch (acao) {
    case "reservar":
      if (!ehEditor) return NextResponse.json({ erro: "Só editor reserva." }, { status: 403 });
      r = await reservarPauta(pautaId, sessao.id);
      break;

    case "cancelar":
      if (!ehEditor) return NextResponse.json({ erro: "Só editor cancela." }, { status: 403 });
      r = await cancelarReserva(pautaId, sessao.id);
      break;

    case "entregar":
      if (!ehEditor) return NextResponse.json({ erro: "Só editor entrega." }, { status: 403 });
      r = await entregarPauta(pautaId, sessao.id, String(body?.link ?? ""));
      break;

    // Aprovar deixou de ser exclusividade do inspetor: quem pediu o vídeo
    // também libera. Antes a missão parava em "em revisão" até alguém do
    // controle de qualidade aparecer — e enquanto isso o editor não recebia a
    // próxima nem a pontuação, por um trabalho que já estava entregue.
    //
    // A diferença entre os dois está em `aprovarPauta`: o inspetor aprova
    // qualquer missão e ela vira 'aprovada' (o dono ainda dá o aceite final);
    // o porta-voz só aprova a DELE, e aí já vira 'finalizada' — ele acabou de
    // aceitar, não faz sentido pedir o mesmo clique duas vezes.
    case "aprovar": {
      if (!ehQualidade && !ehPortaVoz) {
        return NextResponse.json(
          { erro: "Só quem pediu o vídeo ou o controle de qualidade aprova." },
          { status: 403 }
        );
      }
      // admin aprova como inspetor (sem amarrar a dono); porta-voz, como dono
      const comoDono = !ehQualidade;
      r = await aprovarPauta(
        pautaId,
        sessao.id,
        typeof body?.nota === "number" ? body.nota : undefined,
        typeof body?.comentario === "string" ? body.comentario : undefined,
        comoDono ? sessao.id : undefined
      );
      break;
    }

    case "reedicao":
      if (!ehQualidade) {
        return NextResponse.json({ erro: "Só o controle de qualidade pede reedição." }, { status: 403 });
      }
      r = await pedirReedicao(pautaId, String(body?.notas ?? ""));
      break;

    // as duas abaixo fecham o ciclo do lado de quem pediu o vídeo. O papel
    // aqui só diz "é um porta-voz"; quem garante que é o DONO da missão é o
    // filtro por porta_voz_id dentro das funções do banco.
    case "aceitar":
      if (!ehPortaVoz) {
        return NextResponse.json({ erro: "Só o porta-voz aceita a entrega." }, { status: 403 });
      }
      r = await aceitarEntrega(pautaId, sessao.id);
      break;

    case "ajuste":
      if (!ehPortaVoz) {
        return NextResponse.json({ erro: "Só o porta-voz pede ajuste." }, { status: 403 });
      }
      r = await pedirAjuste(pautaId, sessao.id, String(body?.notas ?? ""));
      break;

    // chat da missão: qualquer papel entra na chave, mas o VÍNCULO com a
    // pauta (dono / editor que reservou / inspetor) é conferido dentro da
    // enviarMensagem — mesmo princípio do ownership das ações acima
    case "mensagem":
      if (typeof body?.texto !== "string") {
        return NextResponse.json({ erro: "Mensagem vazia." }, { status: 400 });
      }
      r = await enviarMensagem(pautaId, sessao, body.texto);
      break;

    case "denunciar":
      if (typeof body?.texto !== "string") {
        return NextResponse.json({ erro: "Descreva o problema." }, { status: 400 });
      }
      r = await criarDenuncia(pautaId, sessao, body.texto);
      break;

    default:
      return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  }

  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 409 });

  if (acao === "entregar") {
    void registrarEventoGamificacao(sessao.id, "missao_entregue", String(pautaId)).catch((e) =>
      console.error("[gamificacao] falhou ao registrar entrega", e)
    );
  }

  // Avisa quem está do outro lado. Fica DEPOIS do sucesso e sem `await` no
  // resultado: a missão já foi entregue/aprovada no banco, e o Resent fora do
  // ar não pode desfazer isso nem segurar a resposta na cara de quem clicou.
  // Falha vira log, não erro na tela.
  void notificar(acao, pautaId, new URL(request.url).origin, body).catch((e) =>
    console.error("[aviso] falhou depois de", acao, e)
  );

  return NextResponse.json({ ok: true });
}

/** Monta e dispara o aviso certo pra cada transição. Silencioso por dentro. */
async function notificar(
  acao: string,
  pautaId: number,
  origem: string,
  body: Record<string, unknown> | null
): Promise<void> {
  const c = await contatosDaPauta(pautaId);
  if (!c) return;

  const linkDoPortaVoz = `${origem}/porta-voz/missao/db-${pautaId}`;
  const linkDoEditor = `${origem}/editor`;

  if (acao === "entregar" && c.portaVoz) {
    await avisarEntregaPronta(c.portaVoz.email, c.portaVoz.nome, c.titulo, linkDoPortaVoz);
    return;
  }

  if (acao === "aprovar" && c.editor) {
    const nota = typeof body?.nota === "number" ? body.nota : undefined;
    await avisarEntregaAprovada(c.editor.email, c.editor.nome, c.titulo, nota, linkDoEditor);
    return;
  }

  // as duas devolvem a missão pro editor, por caminhos diferentes: o inspetor
  // reprova por qualidade, o porta-voz quer outra coisa. Pra quem recebe, o
  // que importa é o mesmo — voltou pra sua mão, e por quê.
  if ((acao === "reedicao" || acao === "ajuste") && c.editor) {
    const notas = String(body?.notas ?? "");
    await avisarReedicaoPedida(c.editor.email, c.editor.nome, c.titulo, notas, linkDoEditor);
  }
}
