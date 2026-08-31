import { initials } from "@oficina/domain/candidates";
import { SUPPORTERS } from "@oficina/domain/supporters";

/**
 * O mural de quem faz a Oficina.
 *
 * Nada de grade alinhada: cada rosto entra torto, num tom de altura próprio, e
 * balança devagar — como retrato pregado numa parede de cortiça. A variação é
 * DETERMINÍSTICA (sai do índice, nunca de `Math.random`): sorteio aqui daria
 * um valor no servidor e outro no navegador, e o React reclamaria da
 * hidratação a cada carregamento.
 *
 * A lista vive em `packages/domain/src/supporters.ts` — quem for adicionar mexe só lá.
 */

// os ciclos são primos entre si (5, 6, 7): as combinações demoram a se repetir,
// então nem com 30 pessoas o mural cai num padrão visível
const TILT = [-7, 5, -3, 8, -5]; // graus
const OFFSET = [0, 22, -12, 14, 30, -6]; // px de deslocamento vertical
const SWAY = [7.5, 8.4, 9.2, 6.8, 8.9, 7.9, 9.6]; // segundos de balanço

export function Supporters() {
  if (SUPPORTERS.length === 0) return null;

  return (
    <section className="supporter-wall relative overflow-hidden border-t border-line-soft px-6 py-16 lg:py-24">
      <div className="relative mx-auto w-full max-w-4xl">
        <p className="text-center text-[11px] uppercase tracking-[0.16em] text-gold-lo">
          Quem faz a Oficina
        </p>
        <h2 className="mt-3 text-center font-[family-name:var(--font-display)] text-3xl font-semibold text-text lg:text-4xl">
          Gente, não logotipo.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-muted">
          Editores, porta-vozes e quem chegou junto pra guilda sair do papel.
        </p>

        <ul className="wall mt-12 flex flex-wrap items-start justify-center gap-x-6 gap-y-12 sm:gap-x-10">
          {SUPPORTERS.map((p, i) => (
            <li
              key={p.name}
              className="wall__item flex flex-col items-center text-center"
              style={
                {
                  "--tilt": `${TILT[i % TILT.length]}deg`,
                  "--offset": `${OFFSET[i % OFFSET.length]}px`,
                  "--sway-duration": `${SWAY[i % SWAY.length]}s`,
                  "--sway-delay": `${(i % 5) * -1.7}s`,
                } as React.CSSProperties
              }
            >
              <span className="wall__photo grid place-items-center overflow-hidden rounded-full border border-line bg-ink-2 font-[family-name:var(--font-display)] text-xl font-semibold text-gold lg:text-2xl">
                {p.photo ? (
                  <img
                    src={p.photo}
                    alt={p.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  initials(p.name)
                )}
              </span>

              <p className="mt-3 text-sm font-medium text-text">{p.name}</p>
              <p className="mt-0.5 max-w-[9rem] text-xs leading-snug text-muted-2">{p.role}</p>

              {p.instagram && (
                <a
                  href={`https://instagram.com/${p.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tap-target text-xs text-muted"
                >
                  @{p.instagram}
                </a>
              )}
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        /* luz baixa atrás do mural, pra parede não ficar chapada */
        .supporter-wall::before {
          content:""; position:absolute; inset:0; pointer-events:none;
          background:radial-gradient(60% 50% at 50% 40%, rgba(244,206,31,.05), transparent 70%);
        }

        .wall__item {
          /* cada um no seu degrau de altura — é o que tira o alinhamento de fila */
          margin-top: var(--offset);
          width: 8.5rem;
        }

        .wall__photo {
          width: 5.5rem; height: 5.5rem;
          /* o giro fica na FOTO, não no item: o nome embaixo continua reto e
             legível, só o retrato é que está pregado torto */
          transform: rotate(var(--tilt));
          animation: wall-sway var(--sway-duration) ease-in-out infinite;
          animation-delay: var(--sway-delay);
          box-shadow: 0 10px 22px rgba(0,0,0,.45);
          transition: border-color .45s var(--ease-spring), box-shadow .45s var(--ease-spring);
        }

        /* balança em torno do próprio ângulo, subindo e descendo de leve */
        @keyframes wall-sway {
          0%, 100% { transform: rotate(var(--tilt)) translateY(0); }
          50%      { transform: rotate(calc(var(--tilt) * -0.55)) translateY(-9px); }
        }

        /* ao passar por cima, o retrato para de balançar e se endireita —
           quem você está olhando fica de frente */
        .wall__item:hover .wall__photo {
          animation-play-state: paused;
          transform: rotate(0deg) translateY(-4px) scale(1.06);
          border-color: rgba(244,206,31,.6);
          box-shadow: 0 0 0 3px rgba(244,206,31,.1), 0 16px 32px rgba(0,0,0,.5);
        }

        @media (min-width: 1024px) {
          .wall__photo { width: 6.5rem; height: 6.5rem; }
          .wall__item { width: 10rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .wall__photo { animation: none; transition: none; }
        }
      `}</style>
    </section>
  );
}
