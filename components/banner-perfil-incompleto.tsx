import Link from "next/link";

/**
 * Banner de chamada pra completar o perfil.
 * Aparece quando `perfil_completo = false` — ou seja, a pessoa criou a
 * conta mas não terminou o onboarding. Mostra o link certo pro papel dela
 * (editor vs porta-voz) pra não precisar adivinhar pra onde ir.
 */
export function BannerPerfilIncompleto({ papel }: { papel: "editor" | "voz" }) {
  const destino =
    papel === "editor" ? "/editor/criar-perfil" : "/porta-voz/criar-perfil";
  const descricao =
    papel === "editor"
      ? "Adicione suas skills, softwares e portfólio pra guilda te conhecer melhor."
      : "Preencha cargo, bandeiras e estilo pra sua missão sair redonda.";

  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/[0.10] to-gold/[0.04] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gold">
            Perfil incompleto —{" "}
            {papel === "editor"
              ? "complete seu cadastro de editor"
              : "complete seu cadastro de candidato"}
          </p>
          <p className="mt-1 text-sm text-muted">{descricao}</p>
        </div>
        <Link
          href={destino}
          className="inline-flex flex-none items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-5 py-2.5 text-sm font-semibold text-gold-hi transition-colors hover:bg-gold/20"
        >
          Completar perfil
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M5 3l5 5-5 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
