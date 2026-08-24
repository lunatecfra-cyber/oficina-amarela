import { NextResponse } from "next/server";
import { salvarOnboardingCandidato } from "@/lib/candidato-db";
import { lerSessao } from "@/lib/sessao-servidor";
import type { RedesSociais } from "@/lib/candidatos";

const soTexto = (v: unknown) => (typeof v === "string" ? v : undefined);
const soLista = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

function soRedes(v: unknown): RedesSociais {
  if (typeof v !== "object" || v === null) return {};
  const r = v as Record<string, unknown>;
  const redes: RedesSociais = {};
  for (const campo of ["instagram", "youtube", "tiktok", "x"] as const) {
    if (typeof r[campo] === "string" && r[campo].trim()) redes[campo] = r[campo].trim();
  }
  return redes;
}

export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  if (sessao.papel !== "voz" && sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só porta-voz preenche esse perfil." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.nome !== "string") {
    return NextResponse.json({ erro: "Digite seu nome." }, { status: 400 });
  }

  const r = await salvarOnboardingCandidato(sessao.id, {
    nome: body.nome,
    fotoUrl: soTexto(body.fotoUrl),
    cargo: soTexto(body.cargo),
    disputaPor: soTexto(body.disputaPor),
    anoEleicao: soTexto(body.anoEleicao),
    localizacao: soTexto(body.localizacao),
    bandeiras: soLista(body.bandeiras),
    tomComunicacao: soTexto(body.tomComunicacao),
    palavrasChave: soLista(body.palavrasChave),
    redes: soRedes(body.redes),
    bio: soTexto(body.bio),
    marcaDagua: soTexto(body.marcaDagua),
    cnpjCampanha: soTexto(body.cnpjCampanha),
    tituloEleitor: soTexto(body.tituloEleitor),
  });

  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
  return NextResponse.json({ ok: true });
}
