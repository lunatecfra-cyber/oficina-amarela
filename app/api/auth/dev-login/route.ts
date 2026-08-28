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

const NOME_COOKIE_DEMO = "oficina_demo_papel";

export async function GET(request: Request) {
  if (!ambienteDeDesenvolvimento()) {
    return NextResponse.json({ erro: "Rota disponível só em desenvolvimento." }, { status: 404 });
  }

  const url = new URL(request.url);
  const papelParam = url.searchParams.get("papel");
  const papel: Papel =
    papelParam === "editor" || papelParam === "voz" || papelParam === "admin" ? papelParam : "editor";

  const conta = CONTAS[papel];
  const destino =
    url.searchParams.get("destino") === "perfil"
      ? papel === "editor"
        ? "/editor/criar-perfil"
        : papel === "voz"
          ? "/porta-voz/criar-perfil"
          : conta.destino
      : conta.destino;

  // cria na primeira vez, reaproveita depois. senha_hash fica NULL: essa conta
  // não loga por senha, só por este atalho
  const [linha] = await sql`
    INSERT INTO users (apelido, nome, email, papel)
    VALUES (${conta.apelido}, ${conta.nome}, ${conta.email}, ${papel})
    ON CONFLICT (lower(apelido)) DO UPDATE SET nome = EXCLUDED.nome
    RETURNING id, apelido, nome, papel
  `;

  // Sem DATABASE_URL, lib/db devolve uma lista vazia para manter as telas
  // navegáveis localmente. Nesse caso, usa uma identidade sintética de demo;
  // ela nunca é criada nem aceita fora deste ambiente.
  const sessao = linha ?? {
    id: 9000 + (papel === "editor" ? 1 : papel === "voz" ? 2 : 3),
    apelido: conta.apelido,
    nome: conta.nome,
    papel,
  };

  const token = await criarTokenSessao({
    id: sessao.id,
    apelido: sessao.apelido,
    nome: sessao.nome,
    papel: sessao.papel,
  });

  const jar = await cookies();
  jar.set(NOME_COOKIE, token, COOKIE_OPTS);
  if (!linha) {
    jar.set(NOME_COOKIE_DEMO, papel, COOKIE_OPTS);
  }

  return NextResponse.redirect(new URL(destino, url.origin));
}
