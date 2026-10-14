import Link from "next/link";
import { redirect } from "next/navigation";
import { PortfolioManager } from "@/components/portfolio-manager";
import { requireSession } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export default async function PortfolioPage() {
  const session = await requireSession();
  if (session.role === "inspector") redirect("/inspetor");
  return (
    <main className="mx-auto w-full max-w-4xl p-5 lg:p-8">
      <Link
        href={
          session.role === "editor"
            ? "/perfil"
            : session.role === "admin"
              ? "/inspetor"
              : "/porta-voz"
        }
        className="text-sm text-gold-hi"
      >
        Voltar ao meu painel
      </Link>
      <h1 className="mt-5 text-2xl font-semibold text-text">
        {session.role === "editor" ? "Meu portfólio" : "Autorizações de portfólio"}
      </h1>
      <PortfolioManager />
    </main>
  );
}
