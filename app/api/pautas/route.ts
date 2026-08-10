import { NextResponse } from "next/server";
import { criarPauta } from "@/lib/pautas-db";
import { lerSessao } from "@/lib/sessao-servidor";

export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) {
    return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  }
  if (sessao.papel !== "voz" && sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só porta-voz cria pauta." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { titulo, formato, driveLink, tom, cor, fonte, refs, extras, motivo, prazo } = body ?? {};

  if (typeof titulo !== "string" || (formato !== "short" && formato !== "longo")) {
    return NextResponse.json({ erro: "Preencha título e formato." }, { status: 400 });
  }

  const resultado = await criarPauta({
    portaVozId: sessao.id,
    titulo,
    formato,
    driveLink: typeof driveLink === "string" ? driveLink : undefined,
    tom: typeof tom === "string" ? tom : undefined,
    cor: typeof cor === "string" ? cor : undefined,
    fonte: typeof fonte === "string" ? fonte : undefined,
    refs: typeof refs === "string" ? refs : undefined,
    extras: typeof extras === "string" ? extras : undefined,
    motivo: typeof motivo === "string" ? motivo : undefined,
    prazo: typeof prazo === "string" ? prazo : undefined,
  });

  if (!resultado.ok) {
    return NextResponse.json({ erro: resultado.erro }, { status: 400 });
  }

  return NextResponse.json({ ok: true, id: resultado.id });
}
