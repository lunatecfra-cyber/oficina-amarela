"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SessaoData = Record<string, unknown> | null;

export function DevToolbar() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [abaAberta, setAbaAberta] = useState<"criacao" | "testes" | "online" | "ferramentas" | null>(null);
  
  const [xrayAtivo, setXrayAtivo] = useState(false);
  const [godModeAtivo, setGodModeAtivo] = useState(false);
  const [sessaoData, setSessaoData] = useState<SessaoData>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(false);

  useEffect(() => {
    // A barra só pode aparecer depois de confirmar o ambiente do navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    setGodModeAtivo(document.cookie.includes("dev_god_mode=true"));
  }, []);

  // Garante que só renderiza no ambiente local (dev)
  if (process.env.NODE_ENV !== "development" || !mounted) {
    return null;
  }

  const fecharMenu = () => setAbaAberta(null);
  const toggleAba = (aba: "criacao" | "testes" | "online" | "ferramentas") => {
    if (aba === "ferramentas" && abaAberta !== "ferramentas") {
      carregarSessao();
    }
    setAbaAberta((prev) => (prev === aba ? null : aba));
  };

  const toggleXray = () => setXrayAtivo(!xrayAtivo);

  const toggleGodMode = () => {
    if (godModeAtivo) {
      document.cookie = "dev_god_mode=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      setGodModeAtivo(false);
    } else {
      document.cookie = "dev_god_mode=true; path=/;";
      setGodModeAtivo(true);
    }
    window.location.reload();
  };

  const hardReset = async () => {
    if (confirm("Isso vai apagar TUDO (Cookies, LocalStorage, SessionStorage) e deslogar. Tem certeza?")) {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    }
  };

  const sair = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const carregarSessao = async () => {
    if (sessaoData) return;
    setCarregandoSessao(true);
    try {
      const res = await fetch("/api/auth/sessao");
      const data = await res.json();
      setSessaoData(data);
    } catch {
      setSessaoData({ erro: "Falha ao carregar a sessão local" });
    } finally {
      setCarregandoSessao(false);
    }
  };

  return (
    <>
      {xrayAtivo && (
        <style dangerouslySetInnerHTML={{ __html: `
          * { outline: 1px solid rgba(255, 0, 0, 0.2) !important; }
          div { outline: 1px solid rgba(0, 0, 255, 0.15) !important; }
          span, a, button { outline: 1px dashed rgba(0, 255, 0, 0.35) !important; }
        `}} />
      )}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center">
      {/* Menu Expandido */}
      {abaAberta && (
        <div className="mb-3 w-[320px] rounded-xl border border-gold-lo/50 bg-ink-2/95 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold uppercase tracking-widest text-gold-lo">
              {abaAberta === "criacao" && "Criação"}
              {abaAberta === "testes" && "Testes Locais"}
              {abaAberta === "online" && "Acesso Online"}
              {abaAberta === "ferramentas" && "Ferramentas"}
            </span>
            <button
              onClick={fecharMenu}
              className="text-muted-2 transition-colors hover:text-white"
              title="Fechar"
            >
              ✕
            </button>
          </div>

          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto pr-1">
            {abaAberta === "criacao" && (
              <>
                <div className="rounded border border-line bg-surface/50 p-2">
                  <span className="mb-2 block text-xs font-semibold text-muted">Contas e Perfis</span>
                  <Link href="/criar-conta?papel=voz" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">➔ Criar Porta-Voz</Link>
                  <Link href="/criar-conta?papel=editor" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">➔ Criar Editor</Link>
                </div>
                <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                  <span className="mb-2 block text-xs font-semibold text-muted">Ações</span>
                  <Link href="/porta-voz/nova-pauta" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">➔ Nova Missão (Pauta)</Link>
                </div>
              </>
            )}

            {abaAberta === "testes" && (
              <>
                <div className="rounded border border-line bg-surface/50 p-2">
                  <span className="mb-2 block text-xs font-semibold text-muted">Login Rápido (S/ Senha)</span>
                  <a href="/api/auth/dev-login?papel=voz" className="block text-sm text-silver hover:text-gold-hi py-1">🔓 Entrar como Porta-Voz</a>
                  <a href="/api/auth/dev-login?papel=editor" className="block text-sm text-silver hover:text-gold-hi py-1">🔓 Entrar como Editor</a>
                  <a href="/api/auth/dev-login?papel=admin" className="block text-sm text-silver hover:text-gold-hi py-1">🔓 Entrar como Admin (Inspetor)</a>
                </div>
                <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                  <span className="mb-2 block text-xs font-semibold text-muted">Sessão</span>
                  <button type="button" onClick={sair} className="block w-full py-1 text-left text-sm text-red-400 hover:text-red-300">🚪 Fazer Logout</button>
                  <Link href="/api/auth/sessao" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">🔍 Inspecionar Sessão</Link>
                </div>
                <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                  <span className="mb-2 block text-xs font-semibold text-muted">Painéis</span>
                  <Link href="/porta-voz" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">Painel do Porta-Voz</Link>
                  <Link href="/editor" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">Fila do Editor</Link>
                  <Link href="/agenda" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">Agenda do Editor</Link>
                  <Link href="/inspetor" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">Painel do Inspetor</Link>
                  <Link href="/ranking" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">Ranking</Link>
                </div>
              </>
            )}

            {abaAberta === "online" && (
              <>
                <div className="rounded border border-line bg-surface/50 p-2">
                  <span className="mb-2 block text-xs font-semibold text-muted">Ambiente de Produção</span>
                  <a href="https://oficinaamarela.com.br" target="_blank" rel="noopener noreferrer" className="block text-sm text-silver hover:text-gold-hi py-1">🌐 oficinaamarela.com.br ↗</a>
                </div>
                <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                  <span className="mb-2 block text-xs font-semibold text-muted">Documentação</span>
                  <Link href="/docs/SPEC.md" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">📄 Ver SPEC.md</Link>
                  <Link href="/docs/PLANO.md" onClick={fecharMenu} className="block text-sm text-silver hover:text-gold-hi py-1">📄 Ver PLANO.md</Link>
                </div>
              </>
            )}

            {abaAberta === "ferramentas" && (
              <>
                <div className="rounded border border-line bg-surface/50 p-2">
                  <span className="mb-2 block text-xs font-semibold text-muted">Controle Mestre</span>
                  <button onClick={toggleGodMode} className="w-full text-left block text-sm text-silver hover:text-gold-hi py-1">
                    {godModeAtivo ? "🔓 Desativar Passe Livre" : "🔐 Ativar Passe Livre (God Mode)"}
                  </button>
                </div>
                <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                  <span className="mb-2 block text-xs font-semibold text-muted">Layout & Caches</span>
                  <button onClick={toggleXray} className="w-full text-left block text-sm text-silver hover:text-gold-hi py-1">
                    {xrayAtivo ? "🟢 Raio-X Ativo (Desativar)" : "🔘 Ativar Modo Raio-X"}
                  </button>
                  <button onClick={hardReset} className="w-full text-left block text-sm text-red-400 hover:text-red-300 py-1">
                    💥 Limpar Tudo (Hard Reset)
                  </button>
                </div>
                <div className="rounded border border-line bg-surface/50 p-2 mt-1">
                  <span className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
                    <span>Sessão Atual</span>
                    <button onClick={() => { setSessaoData(null); carregarSessao(); }} className="text-muted hover:text-silver">↻</button>
                  </span>
                  <div className="max-h-40 overflow-y-auto rounded bg-ink-2 p-2 text-[10px] font-mono text-muted-2">
                    {carregandoSessao ? "Carregando..." : <pre>{JSON.stringify(sessaoData, null, 2)}</pre>}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Barra Base (Sempre visível) */}
      <div className="flex max-w-[calc(100vw-1rem)] items-center gap-1 overflow-x-auto rounded-full border border-gold-lo/30 bg-surface-2/90 px-2 py-1.5 shadow-xl backdrop-blur-md">
        <div className="mr-2 flex items-center gap-2 pl-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ok"></span>
          </span>
          <span className="font-[family-name:var(--font-display)] text-[10px] font-bold uppercase tracking-wider text-muted-2">
            Dev
          </span>
        </div>

        <button
          onClick={() => toggleAba("criacao")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            abaAberta === "criacao"
              ? "bg-gold/20 text-gold-hi"
              : "text-muted hover:bg-surface hover:text-silver"
          }`}
        >
          Criação
        </button>
        <button
          onClick={() => toggleAba("testes")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            abaAberta === "testes"
              ? "bg-gold/20 text-gold-hi"
              : "text-muted hover:bg-surface hover:text-silver"
          }`}
        >
          Testes Local
        </button>
        <button
          onClick={() => toggleAba("online")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            abaAberta === "online"
              ? "bg-gold/20 text-gold-hi"
              : "text-muted hover:bg-surface hover:text-silver"
          }`}
        >
          Online
        </button>
        <button
          onClick={() => toggleAba("ferramentas")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            abaAberta === "ferramentas"
              ? "bg-gold/20 text-gold-hi"
              : "text-muted hover:bg-surface hover:text-silver"
          }`}
        >
          Ferramentas
        </button>

        <Link
          href="/dev"
          title="Acessar página completa de Dev"
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-gold-hi"
        >
          ⚙️
        </Link>
      </div>
    </div>
    </>
  );
}
