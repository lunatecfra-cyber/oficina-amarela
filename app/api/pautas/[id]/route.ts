import { NextResponse } from "next/server";
import {
  aceitarEntrega,
  aprovarPauta,
  cancelarReserva,
  entregarPauta,
  pedirAjuste,
  pedirReedicao,
  reservarPauta,
} from "@/lib/pautas-db";
import { lerSessao } from "@/lib/sessao-servidor";

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

    case "aprovar":
      if (!ehQualidade) {
        return NextResponse.json({ erro: "Só o controle de qualidade aprova." }, { status: 403 });
      }
      r = await aprovarPauta(
        pautaId,
        typeof body?.nota === "number" ? body.nota : undefined,
        typeof body?.comentario === "string" ? body.comentario : undefined
      );
      break;

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

    default:
      return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  }

  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 409 });
  return NextResponse.json({ ok: true });
}
