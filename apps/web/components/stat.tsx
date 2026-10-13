export function Stat({
  value,
  valor,
  label,
  rotulo,
  star,
  estrela,
  fire,
  fogo,
}: {
  value?: string;
  valor?: string;
  label?: string;
  rotulo?: string;
  star?: boolean;
  estrela?: boolean;
  fire?: boolean;
  fogo?: boolean;
}) {
  const displayValue = value ?? valor ?? "";
  const displayLabel = label ?? rotulo ?? "";
  const showStar = star ?? estrela;
  const showFire = fire ?? fogo;

  return (
    <div className="tabular-nums">
      {/* <p> em vez de <dd>/<dt>: o valor vem antes do rótulo no desenho, e
          nessa ordem o par dd→dt é HTML inválido dentro de <dl>. */}
      <p className="flex items-center gap-1.5 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
        {showStar && (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 flex-none text-gold"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z" />
          </svg>
        )}
        {/* O emoji 🔥 quebrava com a Cinzel e com os ícones de contorno do
            resto da página: chama em traço fino, na mesma língua visual. */}
        {showFire && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4 flex-none text-gold"
            aria-hidden="true"
          >
            <path
              d="M12 3.5s5.2 4 5.2 8.6a5.2 5.2 0 0 1-10.4 0c0-1.7.8-3.2 1.8-4.4.3 1.2 1 2 1.9 2.3.3-2.6.7-4.6 1.5-6.5Z"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {displayValue}
      </p>
      <p className="mt-0.5 text-xs uppercase tracking-[0.1em] text-muted-2">{displayLabel}</p>
    </div>
  );
}
