import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { EscolherPapelForm } from "@/components/escolher-papel-form";
import { NOME_COOKIE_PENDENTE, verificarIdentidadePendente } from "@/lib/sessao";

export const metadata: Metadata = { title: "Quase lá — Oficina Amarela" };

// O token da identidade confirmada pelo Google vem de cookie httpOnly, não mais
// da query string: ele cria uma conta com aquele e-mail, então na URL ficava
// exposto no histórico e nos logs. A tela nunca mais vê o token — o formulário
// só manda "editor" ou "voz", e a rota lê o cookie por conta própria.
export default async function EscolherPapelPage() {
  const jar = await cookies();
  const token = jar.get(NOME_COOKIE_PENDENTE)?.value;
  const pendente = token ? await verificarIdentidadePendente(token) : null;

  if (!pendente) {
    redirect(`/login?erro_google=${encodeURIComponent("Sessão expirou, tenta de novo.")}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-14">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="w-16" />
        <p className="text-gold-grad mt-3 font-[family-name:var(--font-display)] text-xl font-semibold tracking-[0.15em]">
          OFICINA AMARELA
        </p>
      </div>
      <EscolherPapelForm nome={pendente.nome} foto={pendente.foto} />
    </main>
  );
}
