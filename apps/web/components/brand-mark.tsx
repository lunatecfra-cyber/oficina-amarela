import Image from "next/image";

/**
 * O emblema com o nome em dourado — a marca dos cabeçalhos internos.
 *
 * Existe porque o componente `Logo` já traz o nome em BRANCO por dentro, e os
 * cabeçalhos punham um nome dourado ao lado dele: a marca aparecia duas vezes.
 * Aqui o emblema vem sozinho e o nome é escrito uma vez só.
 *
 * `Logo` continua valendo onde o branco é o certo (páginas públicas).
 */
export function BrandMark({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <>
      <Image
        src="/emblema.png"
        alt=""
        aria-hidden="true"
        width={365}
        height={365}
        priority
        className="h-10 w-10 flex-none select-none lg:h-12 lg:w-12"
      />
      <span>
        {/* 13px no celular não é economia à toa: em 345px o nome em 16px
            empurrava "Sair" pra fora da tela. Sobe a partir de `sm`. */}
        <span className="block font-[family-name:var(--font-display)] text-[13px] font-semibold leading-none tracking-[0.1em] text-gold sm:text-base sm:tracking-[0.16em] lg:text-xl lg:tracking-[0.24em]">
          OFICINA AMARELA
        </span>
        {subtitle && (
          <span className="mt-1 hidden text-xs uppercase tracking-[0.18em] text-muted-2 lg:block">
            A bancada de edição
          </span>
        )}
      </span>
    </>
  );
}
