import Image from "next/image";

const SIZES = {
  small: "w-6 h-6",
  pequeno: "w-6 h-6",
  normal: "w-8 h-8",
  large: "w-10 h-10",
  grande: "w-10 h-10",
};

export function Logo({
  size = "normal",
  withSubtitle = false,
  tamanho,
  comSubtitulo,
  className = "",
}: {
  size?: "small" | "normal" | "large" | "pequeno" | "grande";
  withSubtitle?: boolean;
  tamanho?: "pequeno" | "normal" | "grande";
  comSubtitulo?: boolean;
  className?: string;
}) {
  const chosenSize = tamanho ?? size;
  const showSub = comSubtitulo ?? withSubtitle;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Image
        src="/emblema.png"
        alt=""
        width={365}
        height={365}
        priority
        className={`select-none ${SIZES[chosenSize]}`}
      />
      <div>
        <p className="font-[family-name:var(--font-display)] font-semibold leading-none tracking-[0.14em] text-text">
          OFICINA AMARELA
        </p>
        {showSub && (
          <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-2">
            A bancada de edição
          </p>
        )}
      </div>
    </div>
  );
}
