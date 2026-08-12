import { NextResponse } from "next/server";
import {
  aceitarOferta,
  despacharMissoes,
  expirarOfertasVencidas,
  marcarEditorAtivo,
  ofertaPendente,
  recusarOferta,
} from "@/lib/fila-db";
import { lerSessao } from "@/lib/sessao-servidor";

// O motor da fila. Não existe cron nem worker: cada chamada do editor
// expira o que venceu, despacha o que está parado e devolve o que é dele.
// Quem está esperando missão é justamente quem está fazendo polling, então
// a máquina anda exatamente quando precisa andar.

async function sessaoEditor() {
  const sessao = await lerSessao();
  if (!sessao) return { erro: "Faça login primeiro.", status: 401 as const };
  if (sessao.papel !== "editor" && sessao.papel !== "admin") {
    return { erro: "Só editor recebe missão.", status: 403 as const };
  }
  return { sessao };
}

export async function GET() {
  const r = await sessaoEditor();
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.status });

  await marcarEditorAtivo(r.sessao.id);
  await expirarOfertasVencidas();
  await despacharMissoes();

  const oferta = await ofertaPendente(r.sessao.id);
  // 204 quando não tem nada: resposta vazia, sem corpo pra parsear no cliente
  if (!oferta) return new NextResponse(null, { status: 204 });

  return NextResponse.json(oferta);
}

export async function POST(request: Request) {
  const r = await sessaoEditor();
  if ("erro" in r) return NextResponse.json({ erro: r.erro }, { status: r.status });

  const body = await request.json().catch(() => null);
  const pautaId = Number(String(body?.pautaId ?? "").replace(/^db-/, ""));
  if (!Number.isInteger(pautaId)) {
    return NextResponse.json({ erro: "Missão inválida." }, { status: 400 });
  }

  await marcarEditorAtivo(r.sessao.id);

  const resultado =
    body?.acao === "aceitar"
      ? await aceitarOferta(pautaId, r.sessao.id)
      : body?.acao === "recusar"
        ? await recusarOferta(pautaId, r.sessao.id)
        : null;

  if (!resultado) {
    return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
  }
  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 409 });
  }

  // recusou -> tenta passar pro próximo já nesta requisição, pra missão não
  // esperar o próximo poll de outra pessoa
  if (body.acao === "recusar") await despacharMissoes();

  return NextResponse.json({ ok: true });
}
