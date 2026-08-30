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
    <div>
      <dd className="flex items-center gap-1 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
        {showStar && (
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-gold"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z" />
          </svg>
        )}
        {showFire && <span aria-hidden="true">🔥</span>}
        {displayValue}
      </dd>
      <dt className="text-xs uppercase tracking-[0.1em] text-muted-2">{displayLabel}</dt>
    </div>
  );
}
