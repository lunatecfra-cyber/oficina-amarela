import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { criarTokenSessao, NOME_COOKIE, COOKIE_OPTS, type Papel } from "@/lib/sessao";

// Atalho de login SÓ PRA DESENVOLVIMENTO — entra sem senha.
//
// Dupla trava, de propósito: além do NODE_ENV, checa VERCEL. Um build de
// produção rodando localmente também tem NODE_ENV=production, mas o inverso
// (alguém subir isso pra Vercel com NODE_ENV=development por acidente) abriria
// a porta pra qualquer um logar como editor sem senha. As duas condições
// juntas fecham esse buraco.
function ambienteDeDesenvolvimento() {
  return process.env.NODE_ENV === "development" && !process.env.VERCEL;
}

const CONTAS: Record<Papel, { apelido: string; nome: string; email: string; destino: string }> = {
  editor: {
    apelido: "dev.editor",
    nome: "Editor de Teste",
    email: "dev.editor@oficinaamarela.local",
    destino: "/editor",
  },
  voz: {
    apelido: "dev.portavoz",
    nome: "Porta-voz de Teste",
    email: "dev.portavoz@oficinaamarela.local",
    destino: "/porta-voz",
  },
  admin: {
    apelido: "dev.admin",
    nome: "Admin de Teste",
    email: "dev.admin@oficinaamarela.local",
    destino: "/inspetor",
  },
};

export async function GET(request: Request) {
  if (!ambienteDeDesenvolvimento()) {
    return NextResponse.json({ erro: "Rota disponível só em desenvolvimento." }, { status: 404 });
  }

  const url = new URL(request.url);
  const papelParam = url.searchParams.get("papel");
  const papel: Papel =
    papelParam === "editor" || papelParam === "voz" || papelParam === "admin" ? papelParam : "editor";

  const conta = CONTAS[papel];

  // cria na primeira vez, reaproveita depois. senha_hash fica NULL: essa conta
  // não loga por senha, só por este atalho
  const [linha] = await sql`
    INSERT INTO users (apelido, nome, email, papel)
    VALUES (${conta.apelido}, ${conta.nome}, ${conta.email}, ${papel})
    ON CONFLICT (lower(apelido)) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id, apelido, nome, papel
  `;

  const token = await criarTokenSessao({
    id: linha.id,
    apelido: linha.apelido,
    nome: linha.nome,
    papel: linha.papel,
  });

  const jar = await cookies();
  jar.set(NOME_COOKIE, token, COOKIE_OPTS);

  return NextResponse.redirect(new URL(conta.destino, url.origin));
}
