import type { EditorProfile } from "@oficina/domain/profile";
import { isLikelyUrl } from "@oficina/domain/validators";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchApiJson } from "@/lib/internal-api";
import { requireSession } from "@/lib/server-session";
export const dynamic = "force-dynamic";
export default async function EditorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  await requireSession();
  const { handle } = await params;
  const profile = await fetchApiJson<EditorProfile & { portfolioLink?: string }>(
    `/editors/${encodeURIComponent(handle)}`,
  );
  if (!profile) notFound();
  return (
    <main className="mx-auto max-w-3xl p-5 lg:p-8">
      <Link href="/porta-voz" className="text-sm text-gold-hi">
        Voltar às missões
      </Link>
      <h1 className="mt-5 text-2xl font-semibold text-text">{profile.name}</h1>
      <p className="text-sm text-muted">
        @{profile.handle} · {profile.location}
      </p>
      <p className="mt-4 whitespace-pre-wrap text-muted">{profile.bio}</p>
      <p className="mt-4 text-text">
        {profile.ratingCount
          ? `${profile.rating?.toFixed(1).replace(".", ",")} ★ · ${profile.ratingCount} ${profile.ratingCount === 1 ? "avaliação real" : "avaliações reais"}`
          : "Sem avaliações de porta-vozes"}
      </p>
      <h2 className="mt-6 text-lg font-semibold text-text">Especialidades</h2>
      <p className="mt-2 text-muted">
        {[...(profile.styles || []), ...(profile.niche || [])].join(" · ") || "Não informadas"}
      </p>
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
            <li key={item.id} className="rounded-xl border border-line p-4 text-text">
              {item.title}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-muted">Nenhuma amostra publicada.</p>
      )}
    </main>
  );
}
