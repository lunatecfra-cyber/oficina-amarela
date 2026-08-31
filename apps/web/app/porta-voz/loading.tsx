/**
 * Esqueleto da área do porta-voz.
 *
 * As telas são `force-dynamic` e consultam o banco, então essa espera existe de
 * verdade. Um esqueleto com a FORMA da tela que vem — título, botão, faixa de
 * números, lista — engana menos que um spinner: a página não pula de lugar
 * quando o conteúdo chega.
 */
function Bloco({ className }: { className: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-line-soft/60 ${className}`} aria-hidden="true" />
  );
}

export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl px-5 py-6 lg:px-8 lg:py-10"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Carregando suas missões…</span>

      <Bloco className="h-8 w-52" />
      <Bloco className="mt-3 h-4 w-72 max-w-full" />
      <Bloco className="mt-5 h-[50px] w-full" />

      {/* a faixa dos quatro números */}
      <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-line sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`px-4 py-3.5 ${i % 2 === 1 ? "border-l border-line-soft" : ""} ${
              i >= 2 ? "border-t border-line-soft sm:border-t-0 sm:border-l" : ""
            }`}
          >
            <Bloco className="h-7 w-8" />
            <Bloco className="mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>

      <ul className="mt-6 flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-2xl border border-l-[3px] border-line px-4 py-3.5">
            <Bloco className="h-5 w-2/3" />
            <Bloco className="mt-2 h-4 w-1/2" />
            <Bloco className="mt-2 h-3 w-3/4" />
          </li>
        ))}
      </ul>
    </div>
  );
}
