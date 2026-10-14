import type { PortfolioSample } from "@oficina/domain/portfolio";
import type { EditorProfile } from "@oficina/domain/profile";
import { isLikelyUrl } from "@oficina/domain/validators";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import {
  type DirectoryDetails,
  EditorDirectoryDetails,
} from "@/components/editor-directory-details";
import { PortfolioSamplePreview } from "@/components/portfolio-sample";
import { fetchApiJson } from "@/lib/internal-api";
import { requireSession } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export default async function EditorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const session = await requireSession();
  const { handle } = await params;
  const home =
    session.role === "spokesperson"
      ? { href: "/editores", label: "Voltar ao diretório de editores" }
      : session.role === "editor"
        ? { href: "/editor", label: "Voltar à minha fila" }
        : { href: "/inspetor", label: "Voltar à inspeção" };
  const profile = await fetchApiJson<
    Omit<EditorProfile, "portfolio"> &
      DirectoryDetails & { portfolio: PortfolioSample[]; portfolioLink?: string }
  >(`/editors/${encodeURIComponent(handle)}`);
  if (!profile) notFound();
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl p-5 lg:p-8">
        <Link href={home.href} className="tap-target -ml-3 text-sm text-gold-hi">
          {home.label}
        </Link>
        <h1 className="mt-5 text-2xl font-semibold text-text">{profile.name}</h1>
        <p className="text-sm text-muted">
          @{profile.handle}
          {profile.location ? ` · ${profile.location}` : ""}
        </p>
        <p className="mt-4 whitespace-pre-wrap text-muted">{profile.bio}</p>
        <p className="mt-4 text-text">
          {profile.ratingCount
            ? `${profile.rating?.toFixed(1).replace(".", ",")} ★ · ${profile.ratingCount} ${profile.ratingCount === 1 ? "avaliação" : "avaliações"}`
            : "Sem avaliações de porta-vozes"}
        </p>
        <h2 className="mt-6 text-lg font-semibold text-text">Especialidades</h2>
        <p className="mt-2 text-muted">
          {[...(profile.styles || []), ...(profile.niche || [])].join(" · ") || "Não informadas"}
        </p>
        <EditorDirectoryDetails editor={profile} />
        {session.role === "spokesperson" && (
          <Link
            href={`/editores?editor=${encodeURIComponent(profile.handle)}`}
            className="btn-gold mt-5"
          >
            Escolher missão e convidar este editor
          </Link>
        )}
        <h2 className="mt-6 text-lg font-semibold text-text">Portfólio publicado</h2>
        {profile.portfolioLink && isLikelyUrl(profile.portfolioLink) && (
          <a
            className="mt-2 block text-gold-hi underline"
            href={profile.portfolioLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir portfólio autorizado
          </a>
        )}
        {profile.portfolio.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {profile.portfolio.map((item) => (
              <li key={item.id}>
                <PortfolioSamplePreview sample={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">Nenhuma amostra publicada.</p>
        )}
      </main>
    </>
  );
}
