import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";

export const metadata: Metadata = { title: "Parceiros — Oficina Amarela" };

const PARCEIROS = [
  {
    nome: "Discord",
    descricao: "Servidor pra conversar, tirar dúvidas e acompanhar o que tá rolando.",
    url: "https://discord.gg/NA3BJAsYfK",
    icone: (
      <path d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.9 19.9 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    ),
  },
  {
    nome: "WhatsApp",
    descricao: "Grupo pra trocar ideia, pedir ajuda e ficar por dentro das novidades.",
    url: "https://chat.whatsapp.com/IvBufb6H1a52HoVV4uxXmR",
    icone: (
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z" />
    ),
  },
];

export default function ParceirosPage() {
  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 lg:px-8 lg:py-12">
          <div className="mb-8">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-text lg:text-3xl">
              Parceiros
            </h1>
            <p className="mt-1 text-sm text-muted">
              Comunidades parceiras pra você se conectar.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {PARCEIROS.map((c) => {
              const isWsp = c.nome.toLowerCase().includes("whatsapp");
              const corMarca = isWsp ? "#25D366" : "#5865F2";
              return (
                <li key={c.nome}>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-5 transition-all duration-300"
                    style={{
                      borderColor: `${corMarca}40`,
                      background: `linear-gradient(135deg, ${corMarca}12 0%, rgba(20,20,25,0.7) 100%)`,
                    }}
                  >
                    <div
                      className="absolute -right-8 -top-8 h-24 w-24 rounded-full blur-xl transition-all duration-500 opacity-20 group-hover:opacity-40"
                      style={{ backgroundColor: corMarca }}
                    />
                    <span
                      className="inline-grid h-12 w-12 flex-none place-items-center rounded-xl border transition-all duration-300 group-hover:scale-105"
                      style={{
                        borderColor: `${corMarca}50`,
                        backgroundColor: `${corMarca}20`,
                        color: corMarca,
                      }}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="h-6 w-6"
                        aria-hidden="true"
                      >
                        {c.icone}
                      </svg>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="font-[family-name:var(--font-display)] text-base font-semibold text-text sm:text-lg">
                          {c.nome}
                        </h2>
                        <span
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{
                            borderColor: `${corMarca}40`,
                            backgroundColor: `${corMarca}15`,
                            color: corMarca,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 animate-pulse rounded-full"
                            style={{ backgroundColor: corMarca }}
                          />
                          Comunidade
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm leading-relaxed text-muted">
                        {c.descricao}
                      </p>
                    </div>

                    <span
                      className="flex-none text-xs font-semibold uppercase tracking-wide transition-transform duration-300 group-hover:translate-x-1"
                      style={{ color: corMarca }}
                    >
                      Entrar →
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </>
  );
}
