import Link from "next/link";

const STEPS = [
  {
    number: "01",
    title: "Escolha seu papel",
    text: "Entre como porta-voz ou editor e veja apenas o caminho que faz sentido para você.",
    href: "/criar-conta",
    // aliases
    numero: "01",
    titulo: "Escolha seu papel",
    texto: "Entre como porta-voz ou editor e veja apenas o caminho que faz sentido para você.",
  },
  {
    number: "02",
    title: "Encontre seu ritmo",
    text: "Acompanhe missões, aulas e entregas em um fluxo simples, sem se perder entre abas.",
    href: "/login",
    numero: "02",
    titulo: "Encontre seu ritmo",
    texto: "Acompanhe missões, aulas e entregas em um fluxo simples, sem se perder entre abas.",
  },
  {
    number: "03",
    title: "Evolua com a guilda",
    text: "Cada trabalho aprovado fortalece sua reputação e abre espaço para os próximos passos.",
    href: "/parceiros",
    numero: "03",
    titulo: "Evolua com a guilda",
    texto: "Cada trabalho aprovado fortalece sua reputação e abre espaço para os próximos passos.",
  },
];

export function NextStep() {
  return (
    <section className="border-t border-line-soft px-6 py-16 lg:py-20" aria-labelledby="proximo-passo-titulo">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gold-lo">Próximo passo</p>
            <h2 id="proximo-passo-titulo" className="mt-2 font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
              O caminho é esse.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
              Sem promessa pronta: você entra, escolhe seu caminho e começa a participar.
            </p>
          </div>
          <Link href="#como-funciona" className="btn-gold w-full text-center sm:w-auto">
            Ver o caminho
          </Link>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((step) => (
            <Link
              key={step.number}
              href={step.href}
              className="group flex min-h-48 flex-col border-l border-line px-5 transition-colors duration-300 hover:border-gold"
            >
              <span className="font-[family-name:var(--font-display)] text-2xl font-semibold text-gold-hi" aria-hidden="true">
                {step.number}
              </span>
              <h3 className="mt-8 font-[family-name:var(--font-display)] text-xl font-semibold text-text">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
              <span className="mt-auto pt-5 text-sm font-medium text-gold-hi transition-colors group-hover:text-gold">
                Ver caminho <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1 inline-block">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export { NextStep as ProximoPasso };
