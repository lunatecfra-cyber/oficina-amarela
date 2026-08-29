import Link from "next/link";

export function IncompleteProfileBanner({
  role,
  papel,
}: {
  role?: "editor" | "spokesperson" | "voz";
  papel?: "editor" | "voz";
}) {
  const currentRole = role ?? papel ?? "editor";
  const isEditor = currentRole === "editor";
  const destination = isEditor ? "/editor/create-profile" : "/spokesperson/create-profile";
  const description = isEditor
    ? "Adicione suas skills, softwares e portfólio pra guilda te conhecer melhor."
    : "Preencha cargo, bandeiras e estilo pra sua missão sair redonda.";

  return (
    <div className="rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/[0.10] to-gold/[0.04] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gold">
            Perfil incompleto —{" "}
            {isEditor
              ? "complete seu cadastro de editor"
              : "complete seu cadastro de candidato"}
          </p>
          <p className="mt-1 text-sm text-muted">{description}</p>
        </div>
        <Link
          href={destination}
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

export { IncompleteProfileBanner as BannerPerfilIncompleto };
