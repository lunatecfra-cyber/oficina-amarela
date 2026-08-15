import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  alternarPublicacao,
  apagarNovidade,
  criarNovidade,
} from "@/lib/novidades-db";
import { lerSessao } from "@/lib/sessao-servidor";

/**
 * A página inicial guarda a versão pronta por 5 minutos, pra não consultar o
 * banco a cada visita. Ótimo pra quem lê, péssimo pra quem escreve: publicava
 * e não via nada mudar, o que parece defeito. Isto joga fora a versão guardada
 * no instante da mudança — o cache continua valendo pra todo o resto do tempo.
 */
function atualizarPaginaInicial() {
  revalidatePath("/");
}

/** As novidades aparecem numa página pública, sem login. Quem escreve tem que
 *  ser inspetor — senão qualquer conta publicaria texto na porta de entrada. */
async function exigirAdmin() {
  const sessao = await lerSessao();
  if (!sessao) {
    return { ok: false as const, resp: NextResponse.json({ erro: "Faça login." }, { status: 401 }) };
  }
  if (sessao.papel !== "admin") {
    return { ok: false as const, resp: NextResponse.json({ erro: "Só o inspetor." }, { status: 403 }) };
  }
  return { ok: true as const, sessao };
}

/** POST — cria, publica/despublica ou apaga.
 *  body: { acao: "criar", titulo, texto } | { acao: "alternar" | "apagar", id } */
export async function POST(request: Request) {
  const auth = await exigirAdmin();
  if (!auth.ok) return auth.resp;

  const body = await request.json().catch(() => null);
  const acao = body?.acao;

  if (acao === "criar") {
    const r = await criarNovidade(
      auth.sessao.id,
      String(body?.titulo ?? ""),
      String(body?.texto ?? "")
    );
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
    atualizarPaginaInicial();
    return NextResponse.json({ ok: true, id: r.id });
  }

  const id = body?.id;
  if (typeof id !== "number" || !Number.isFinite(id)) {
    return NextResponse.json({ erro: "Novidade inválida." }, { status: 400 });
  }

  if (acao === "alternar") {
    const r = await alternarPublicacao(id);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
    atualizarPaginaInicial();
    return NextResponse.json({ ok: true, publicada: r.publicada });
  }

  if (acao === "apagar") {
    const r = await apagarNovidade(id);
    if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
    atualizarPaginaInicial();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: "Ação desconhecida." }, { status: 400 });
}
