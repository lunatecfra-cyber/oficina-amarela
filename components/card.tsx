export function Card({
  titulo,
  delay = 0,
  guia,
  children,
}: {
  titulo: string;
  delay?: number;
  /** alvo do guia "Como usar", quando este cartão é ensinado */
  guia?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-guia={guia}
      className="reveal rounded-2xl border border-line bg-surface/60 p-5 lg:p-6"
      style={{ animationDelay: `${delay}s` }}
    >
      <h2 className="mb-4 text-xs font-medium uppercase tracking-[0.14em] text-gold">
        {titulo}
      </h2>
      {children}
    </section>
  );
}
