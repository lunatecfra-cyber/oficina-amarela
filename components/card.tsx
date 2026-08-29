export function Card({
  title,
  titulo,
  delay = 0,
  guide,
  guia,
  children,
}: {
  title?: string;
  titulo?: string;
  delay?: number;
  guide?: string;
  guia?: string;
  children: React.ReactNode;
}) {
  const displayTitle = title ?? titulo ?? "";
  const guideTarget = guide ?? guia;
  return (
    <section
      data-guia={guideTarget}
      className="reveal rounded-2xl border border-line bg-surface/60 p-5 lg:p-6"
      style={{ animationDelay: `${delay}s` }}
    >
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-gold">
        {displayTitle}
      </h2>
      {children}
    </section>
  );
}
