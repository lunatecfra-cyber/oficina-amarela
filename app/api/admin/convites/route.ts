import { NextResponse } from "next/server";
import {
  criarConvitePortaVoz,
  listarConvitesPortaVoz,
  revogarConvitePortaVoz,
} from "@/lib/convites-db";
import { lerSessao } from "@/lib/sessao-servidor";

async function exigirInspetor() {
  const sessao = await lerSessao();
  if (!sessao) return { erro: NextResponse.json({ erro: "Faça login." }, { status: 401 }) };
  if (sessao.papel !== "admin") {
    return { erro: NextResponse.json({ erro: "Só o inspetor." }, { status: 403 }) };
  }
  return { sessao };
}

export async function GET() {
  const acesso = await exigirInspetor();
  if ("erro" in acesso) return acesso.erro;
  return NextResponse.json({ convites: await listarConvitesPortaVoz() });
}

export async function POST(request: Request) {
  const acesso = await exigirInspetor();
  if ("erro" in acesso) return acesso.erro;
  const body = await request.json().catch(() => null);
  if (body?.acao === "revogar") {
    const id = Number(body?.id);
    if (!Number.isInteger(id)) return NextResponse.json({ erro: "Convite inválido." }, { status: 400 });
    const resultado = await revogarConvitePortaVoz(id, acesso.sessao.id);
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 409 });
  }
  const resultado = await criarConvitePortaVoz(String(body?.email ?? ""), acesso.sessao.id);
  if (!resultado.ok) return NextResponse.json(resultado, { status: 400 });
  const origem = new URL(request.url).origin;
  return NextResponse.json({
    ...resultado,
    link: `${origem}/criar-conta?convite=${encodeURIComponent(resultado.token)}`,
  });
}
