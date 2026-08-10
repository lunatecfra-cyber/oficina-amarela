import { NextResponse } from "next/server";
import { salvarOnboardingEditor } from "@/lib/perfil-db";
import { lerSessao } from "@/lib/sessao-servidor";

const soTexto = (v: unknown) => (typeof v === "string" ? v : undefined);
const soLista = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export async function POST(request: Request) {
  const sessao = await lerSessao();
  if (!sessao) return NextResponse.json({ erro: "Faça login primeiro." }, { status: 401 });
  if (sessao.papel !== "editor" && sessao.papel !== "admin") {
    return NextResponse.json({ erro: "Só editor preenche esse perfil." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (typeof body?.nome !== "string") {
    return NextResponse.json({ erro: "Digite seu nome." }, { status: 400 });
  }

  // a grade tem que ser 3 períodos x 7 dias de booleanos — não confio no
  // formato que veio do cliente. undefined (não veio nada) é proposital: o
  // onboarding não tem mais a Forja, então não manda grade — e undefined faz
  // salvarOnboardingEditor preservar o que já foi marcado na Agenda
  const bruta = body?.disponibilidade;
  const disponibilidade: boolean[][] | undefined =
    Array.isArray(bruta) && bruta.length === 3 && bruta.every((l) => Array.isArray(l) && l.length === 7)
      ? bruta.map((l: unknown[]) => l.map(Boolean))
      : undefined;

  const r = await salvarOnboardingEditor(sessao.id, {
    nome: body.nome,
    fotoUrl: soTexto(body.fotoUrl),
    localizacao: soTexto(body.localizacao),
    headline: soLista(body.headline),
    bio: soTexto(body.bio),
    softwares: soLista(body.softwares),
    estilos: soLista(body.estilos),
    nivelEdicao: soTexto(body.nivelEdicao),
    setupPc: soTexto(body.setupPc),
    portfolioLink: soTexto(body.portfolioLink),
    nicho: soLista(body.nicho),
    disponibilidade,
  });

  if (!r.ok) return NextResponse.json({ erro: r.erro }, { status: 400 });
  return NextResponse.json({ ok: true });
}
