import Link from "next/link";
import { Logo } from "@/components/logo";
import { BotaoSair } from "@/components/botao-sair";
import { NavEditor } from "@/components/nav-editor";
import type { Editor } from "@/lib/pautas";
import { lerPerfilEditor } from "@/lib/perfil-db";
import { lerSessao } from "@/lib/sessao-servidor";

export async function AppHeader() {
  const sessao = await lerSessao();
  const perfil = sessao ? await lerPerfilEditor(sessao.id) : null;

  // Sem sessão, cabeçalho mínimo: logo e "Entrar".
  //
  // Isto existe porque o perfil público do candidato (/candidato/[slug]) usa
  // este mesmo header. Antes, um visitante sem login via o menu do editor
  // (Fila, Agenda, Ranking — todas rotas protegidas), um botão "Sair" e, pior,
  // a identidade do EDITOR_ATUAL de demonstração: "jr.eneias · nota 4.8".
  // O fallback existia pra conta nova não ficar vazia, mas disparava também
  // pra quem nem conta tinha.
  if (!sessao) {
    return (
      <header className="border-b border-line-soft">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Logo className="w-9" />
            <span className="hidden font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold sm:inline">
              OFICINA AMARELA
            </span>
          </Link>

          <Link
            href="/login"
            className="text-sm text-muted transition-colors hover:text-gold-hi"
          >
            Entrar
          </Link>
        </div>
      </header>
    );
  }

  // conta recém-criada ainda não tem perfil montado: mostra o apelido da
  // sessão e números zerados, que são os dela — nunca os de outra pessoa
  const editor: Editor = perfil
    ? {
        apelido: perfil.apelido,
        nivel: (perfil.nivel ?? "Aprendiz") as Editor["nivel"],
        entregues: perfil.entregues,
        nota: perfil.nota,
      }
    : {
        apelido: sessao.apelido,
        nivel: "Aprendiz",
        entregues: 0,
        nota: null,
      };

  return (
    <header className="border-b border-line-soft">
      {/* No celular isto vira DUAS linhas. Numa só, os seis itens somavam 461px
          numa tela de 390: o botão de sair ficava inteiro fora da tela, o selo
          de nível cortado na borda, e a página inteira deslizava pro lado.
          Quem entrava pelo celular não conseguia sair da conta.

          Agora: identidade em cima, navegação embaixo. No PC volta a ser uma
          linha só, que é onde sempre coube. */}
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/editor" className="flex flex-none items-center gap-3">
            <Logo className="w-9" />
            <span className="hidden font-[family-name:var(--font-display)] text-sm font-semibold tracking-[0.24em] text-gold sm:inline">
              OFICINA AMARELA
            </span>
          </Link>

          {/* no celular a navegação desce pra própria linha, logo abaixo */}
          <div className="hidden sm:block">
            <NavEditor />
          </div>
        </div>

        <div className="flex flex-none items-center gap-2 sm:gap-4">
          {/* Até aqui não existia link nenhum pra área do inspetor: só se
              chegava digitando /inspetor na barra de endereço. Quem não sabia
              a URL procurava o botão de aprovar em telas onde ele não existe.
              Só aparece pra quem é admin — pra todo mundo mais seria uma porta
              que não abre. */}
          {sessao.papel === "admin" && (
            <Link
              href="/inspetor"
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-gold-lo/60 hover:text-gold-hi"
            >
              Inspetor
            </Link>
          )}

          <Link
            href="/perfil"
            className="hidden text-right transition-opacity hover:opacity-80 sm:block"
          >
            <p className="text-sm font-medium text-text">{editor.apelido}</p>
            <p className="text-xs text-muted">
              {editor.entregues} entregues
              {editor.nota !== null && ` · nota ${editor.nota}`}
            </p>
          </Link>

          <Link
            href="/perfil"
            className="flex min-h-11 flex-none items-center rounded-full border border-gold-lo/60 bg-gold/10 px-3 text-xs font-medium text-gold-hi transition-colors hover:bg-gold/20"
          >
            {editor.nivel}
          </Link>

          <BotaoSair className="flex min-h-11 flex-none items-center px-1 text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-silver-hi" />
        </div>
      </div>

      {/* segunda linha, só no celular: a navegação com espaço pra respirar */}
      <div className="border-t border-line-soft px-2 pb-1 sm:hidden">
        <NavEditor />
      </div>
    </header>
  );
}
