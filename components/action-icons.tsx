/**
 * Ícones das ações — os que antes eram emoji.
 *
 * Emoji em botão dá dois problemas de uma vez: desenha diferente em cada
 * aparelho (o ✅ do Android não é o do iPhone) e entra no NOME acessível do
 * botão — quem usa leitor de tela ouvia "bandeira vermelha denunciar esta
 * missão". Todos aqui são `aria-hidden`: quem lê a tela ouve só o texto.
 *
 * Herdam `currentColor` e o tamanho vem da classe, como os de social-icons.
 */

type IconProps = { className?: string };

const base = (className?: string) => ({
  viewBox: "0 0 20 20",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: className ?? "h-[18px] w-[18px] flex-none",
});

/** aprovar, aceitar, concluir */
export function IconCheck({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 10.5 8 14.5 16 5.5" />
    </svg>
  );
}

/** conversa, pedir ajuste */
export function IconChat({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M17 12a2 2 0 0 1-2 2H8l-4 3V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2Z" />
    </svg>
  );
}

/** denunciar */
export function IconFlag({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 18V3.5m0 0h9.5l-2 3 2 3H5" />
    </svg>
  );
}

/** assistir, abrir vídeo */
export function IconPlay({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M7 4.8v10.4l8.5-5.2z" />
    </svg>
  );
}

/** pasta do Drive */
export function IconFolder({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h3l1.6 2H15.5A1.5 1.5 0 0 1 17 8.5v6A1.5 1.5 0 0 1 15.5 16h-11A1.5 1.5 0 0 1 3 14.5Z" />
    </svg>
  );
}

/** avisar por e-mail */
export function IconMail({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="14" height="10" rx="1.5" />
      <path d="m3.6 6 6.4 4.6L16.4 6" />
    </svg>
  );
}

/** missão nova, claquete */
export function IconClap({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 8.5h14v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5Z" />
      <path d="m3.4 8.5.9-3.2 13.2 1.6-.4 1.6M7.6 5.6 6.4 8.4M11.8 6.1l-1.2 2.8" />
    </svg>
  );
}

export {
  IconCheck as IconeConfirmar,
  IconChat as IconeConversa,
  IconFlag as IconeDenuncia,
  IconPlay as IconeTocar,
  IconFolder as IconePasta,
  IconMail as IconeEmail,
  IconClap as IconeClaquete,
};

/** sair da fila — era o emoji ⏹, que some no nome do botão */
export function IconStop({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="5.5" y="5.5" width="9" height="9" rx="1.4" />
    </svg>
  );
}

export { IconStop as IconeParar };
