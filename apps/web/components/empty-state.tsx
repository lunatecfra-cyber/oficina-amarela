import Image from "next/image";

/**
 * O bloco de "não tem nada aqui", com o emblema de marca d'água ao fundo.
 *
 * A opacidade é baixa de propósito (0.06): o emblema é textura, não conteúdo —
 * se ele competir com a frase, a pessoa lê o desenho antes de ler o que fazer.
 * Por isso também `aria-hidden` e `alt=""`: pra quem usa leitor de tela, essa
 * imagem simplesmente não existe.
 */
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <Image
        src="/emblema.png"
        alt=""
        aria-hidden="true"
        width={365}
        height={365}
        className="pointer-events-none absolute left-1/2 top-1/2 w-44 -translate-x-1/2 -translate-y-1/2 select-none opacity-[0.06] lg:w-56"
      />

      <div className="relative">
        <p className="text-sm font-medium text-muted">{title}</p>
        {description && (
          <p className="mx-auto mt-2 max-w-xs text-xs leading-relaxed text-muted-2">
            {description}
          </p>
        )}
        {children && <div className="mt-5">{children}</div>}
      </div>
    </div>
  );
}
