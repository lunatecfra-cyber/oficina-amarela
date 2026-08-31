export function FestivalAwards() {
  return (
    <section
      className="premiacao-festival border-y border-gold-lo/20 px-6 py-12 lg:py-16"
      aria-labelledby="premiacao-titulo"
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-gold-lo">Premiação especial</p>
          <h2
            id="premiacao-titulo"
            className="mt-3 max-w-md font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-text lg:text-5xl"
          >
            O topo leva você ao festival.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted lg:text-base">
            Na produção do vídeo de honra e da edição, quem mais se destacar chega ao prêmio
            principal.
          </p>
        </div>

        {/* O ingresso tem 338px e ainda precisa de chão embaixo pra sombra
            aparecer — sem essa folga ela cai atrás dele e o voo não lê. */}
        <div
          className="relative mx-auto h-[28rem] w-full max-w-lg"
          aria-label="Premiação: primeiro lugar ganha ingresso; segundo e terceiro ganham presentes misteriosos"
        >
          <div className="premio-item premio-bandeira" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 52V10m0 2h29l-8 9 8 9H16" />
              <path d="M10 52h14" />
            </svg>
            <span>2º lugar</span>
          </div>

          {/* O ingresso flutua: a sombra fica NUM ELEMENTO SEPARADO, no chão.
              Ela encolhe e clareia quando o ingresso sobe, e volta a crescer
              quando desce — é o que faz o olho ler altura em vez de um cartão
              que só desliza pra cima. */}
          <span className="ingresso-sombra" aria-hidden="true" />

          <div className="ingresso-palco">
            <div className="premio-ingresso">
              <span className="premio-ingresso__brilho" aria-hidden="true" />
              <span className="premio-ingresso__moldura" aria-hidden="true" />

              {/* cabeçalho: quem emite */}
              <span className="premio-ingresso__topo">
                <span className="premio-ingresso__marca">Oficina Amarela</span>
                <span className="premio-ingresso__filete" aria-hidden="true" />
              </span>

              {/* corpo: o que é */}
              <span className="premio-ingresso__label">1º lugar</span>
              <span className="premio-ingresso__title">INGRESSO</span>
              <span className="premio-ingresso__sub">FESTIVAL</span>

              {/* rodapé do corpo: os dados do evento */}
              <span className="premio-ingresso__dados">
                <span>
                  <b>Entrada</b>Inteira
                </span>
                <span>
                  <b>Setor</b>Pista
                </span>
              </span>

              {/* picote e canhoto */}
              <span className="premio-ingresso__picote" aria-hidden="true" />

              <span className="premio-ingresso__canhoto">
                <span className="premio-ingresso__codigo" aria-hidden="true" />
                <span className="premio-ingresso__serie">Nº 001 · PRÊMIO PRINCIPAL</span>
              </span>
            </div>
          </div>

          <div className="premio-item premio-caneca" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 18h34v25a7 7 0 0 1-7 7H21a7 7 0 0 1-7-7V18Z" />
              <path d="M48 24h5a7 7 0 0 1 0 14h-5M22 11v7m9-7v7m9-7v7" />
            </svg>
            <span>3º lugar</span>
          </div>
        </div>
      </div>

      <style>{`
        .premiacao-festival { background: linear-gradient(110deg, rgba(244,206,31,.04), transparent 45%); }
        /* ── O ingresso ──────────────────────────────────────────────────
           O palco existe só pra dar PERSPECTIVA: sem ele, rotateX não tem
           profundidade e o cartão fica chapado. */
        .ingresso-palco { position:absolute; left:50%; top:50%; z-index:2; transform:translate(-50%,-50%); perspective:900px; }

        .premio-ingresso {
          position:relative; display:flex; width:264px; height:338px;
          flex-direction:column; align-items:center;
          /* o padding de baixo RESERVA a faixa do canhoto (94px), que é
             absoluto: sem ele o conteúdo do fluxo escorre por cima do código
             de barras */
          padding:20px 20px 104px;
          border-radius:16px;
          /* Papel com fundo de segurança: luz quente de cima, e por baixo uma
             trama de linhas diagonais finíssimas — o que ingresso e cédula têm
             pra não parecerem papel liso impresso em casa. */
          background:
            repeating-linear-gradient(58deg, rgba(16,18,22,.045) 0 1px, transparent 1px 7px),
            repeating-linear-gradient(-58deg, rgba(16,18,22,.035) 0 1px, transparent 1px 7px),
            radial-gradient(120% 80% at 50% -10%, #fdea7a, transparent 60%),
            linear-gradient(158deg, #f7d92e 0%, #edc61f 46%, #d8b51a 100%);
          color:#101216;
          /* o halo dourado é o que separa o ingresso do fundo e faz ele
             ser a primeira coisa que o olho pega na seção */
          box-shadow:
            0 1px 0 rgba(255,255,255,.55) inset,
            0 2px 8px rgba(0,0,0,.28),
            0 30px 52px rgba(0,0,0,.48),
            0 0 70px rgba(244,206,31,.22),
            0 0 130px rgba(244,206,31,.1);
          /* inclinado no ar: tombado pra trás e torto no eixo Z */
          transform:rotateX(9deg) rotateZ(-3.5deg);
          transform-style:preserve-3d;
          animation:ingresso-voando 5.6s ease-in-out infinite;
        }
        /* As meias-luas são RECORTE, não bolinha pintada por cima.
           Com um círculo da cor do fundo, a ilusão quebra assim que passa
           algo atrás — e passa: os cards de 2º e 3º ficam bem ali. Recortando
           com máscara, o furo deixa ver o que estiver atrás, como no papel. */
        /* Recortes do picote: pequenos (raio 8) e cravados NA borda, como em
           ingresso de verdade. Grandes e sobrando pra fora eles viravam duas
           bolas pretas apoiadas nos cards de trás. */
        .premio-ingresso {
          -webkit-mask-image:
            radial-gradient(circle 8px at 0 calc(100% - 94px), transparent 97%, #000 100%),
            radial-gradient(circle 8px at 100% calc(100% - 94px), transparent 97%, #000 100%);
          -webkit-mask-composite: source-in;
          mask-image:
            radial-gradient(circle 8px at 0 calc(100% - 94px), transparent 97%, #000 100%),
            radial-gradient(circle 8px at 100% calc(100% - 94px), transparent 97%, #000 100%);
          mask-composite: intersect;
        }

        /* moldura interna: a linha fina que emoldura o impresso */
        .premio-ingresso__moldura {
          position:absolute; inset:9px; border-radius:11px; pointer-events:none;
          border:1px solid rgba(16,18,22,.16);
        }

        .premio-ingresso__topo { display:flex; flex-direction:column; align-items:center; width:100%; }
        .premio-ingresso__marca { font-family:Georgia,serif; font-size:11px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; opacity:.66; }
        .premio-ingresso__filete { width:46px; height:2px; margin-top:9px; border-radius:2px; background:rgba(16,18,22,.42); }

        /* dados do evento: duas colunas, rótulo pequeno em cima do valor */
        .premio-ingresso__dados {
          display:flex; gap:26px; margin-top:auto; margin-bottom:14px;
        }
        .premio-ingresso__dados > span {
          display:flex; flex-direction:column; align-items:center; gap:3px;
          font-family:ui-monospace,"SF Mono",Menlo,monospace;
          font-size:11px; font-weight:700; letter-spacing:.04em;
        }
        .premio-ingresso__dados b {
          font-family:var(--font-sans, sans-serif);
          font-size:8px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; opacity:.5;
        }

        .premio-ingresso__label { margin-top:20px; font-size:10px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; opacity:.6; }
        .premio-ingresso__title { margin-top:8px; font-family:Georgia,serif; font-size:38px; font-weight:800; letter-spacing:.01em; line-height:1; }
        .premio-ingresso__sub { margin-top:4px; font-size:15px; font-weight:800; letter-spacing:.32em; opacity:.72; }

        /* Picote de verdade: furos redondos, não linha tracejada. É o detalhe
           que faz o olho reconhecer "isto se destaca aqui". */
        /* Picote: furos pequenos e juntos, com um fio de luz logo abaixo — é a
           sombra rasa que faz o papel parecer vincado ali, e não riscado. */
        .premio-ingresso__picote {
          position:absolute; left:10px; right:10px; bottom:94px; height:3px;
          background:
            radial-gradient(circle, rgba(16,18,22,.5) 1.1px, transparent 1.3px) repeat-x 0 0/7px 3px,
            linear-gradient(rgba(255,255,255,.4), rgba(255,255,255,.4)) repeat-x 0 3px/100% 1px;
        }

        .premio-ingresso__canhoto {
          position:absolute; left:0; right:0; bottom:0; height:94px;
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;
          /* o canhoto é um tom mais fundo: separa do corpo sem precisar de borda */
          background:linear-gradient(180deg, rgba(16,18,22,.05), rgba(16,18,22,.11));
          border-radius:0 0 16px 16px;
        }
        .premio-ingresso__serie { font-family:ui-monospace,"SF Mono",Menlo,monospace; font-size:9px; font-weight:700; letter-spacing:.14em; opacity:.55; }
        /* código de barras desenhado com gradiente: barras de larguras
           irregulares, senão lê como listra decorativa */
        .premio-ingresso__codigo {
          width:152px; height:32px; opacity:.78;
          background:
            repeating-linear-gradient(90deg,
              #101216 0 2px, transparent 2px 4px,
              #101216 4px 5px, transparent 5px 8px,
              #101216 8px 11px, transparent 11px 12px,
              #101216 12px 13px, transparent 13px 16px);
        }

        /* brilho que atravessa o papel, como plástico holográfico pegando luz */
        .premio-ingresso__brilho {
          position:absolute; inset:0; border-radius:14px; overflow:hidden; pointer-events:none;
        }
        .premio-ingresso__brilho::after {
          content:""; position:absolute; inset:-60% -40%;
          background:linear-gradient(72deg, transparent 42%, rgba(255,255,255,.55) 50%, transparent 58%);
          transform:translateX(-130%);
          animation:ingresso-lustro 5.6s ease-in-out infinite;
        }

        /* A sombra no chão: some e encolhe quando o ingresso sobe. */
        .ingresso-sombra {
          position:absolute; left:50%; top:50%; z-index:1;
          width:206px; height:30px; margin-top:196px;
          transform:translate(-50%,-50%);
          border-radius:50%;
          background:radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.55), transparent 70%);
          filter:blur(7px);
          animation:ingresso-sombra 5.6s ease-in-out infinite;
        }
        /* Os laterais recuam de propósito: menores, mais escuros e um degrau
           atrás. Sem essa diferença de peso os três leem como trio igual, e o
           1º lugar deixa de ser o prêmio principal. */
        .premio-item { position:absolute; top:50%; display:flex; width:140px; height:176px; transform:translateY(-50%); flex-direction:column; align-items:center; justify-content:center; border:1px solid #3a3e44; border-radius:12px; background:linear-gradient(145deg,#1e2229,#101317); color:#82868e; box-shadow:0 14px 28px rgba(0,0,0,.4); }
        .premio-item svg { width:58px; height:58px; margin-bottom:14px; }
        .premio-item span { font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
        .premio-bandeira { left:0; transform:translateY(-50%) rotate(-8deg); animation: item-esquerdo 4.8s ease-in-out infinite; }
        .premio-caneca { right:0; transform:translateY(-50%) rotate(8deg); animation: item-direito 4.8s ease-in-out infinite; }
        /* Sobe girando de leve, como papel achando o ar — nunca só translateY,
           que lê como elevador. A ida e a volta passam por ângulos diferentes
           pra não parecer um vaivém mecânico. */
        @keyframes ingresso-voando {
          0%, 100% { transform:translateY(9px) rotateX(11deg) rotateZ(-3.5deg); }
          35%      { transform:translateY(-6px) rotateX(7deg) rotateZ(-1.5deg); }
          65%      { transform:translateY(-11px) rotateX(9deg) rotateZ(-4.5deg); }
        }
        /* a sombra é o contrapeso: grande e escura embaixo, pequena e clara no alto */
        @keyframes ingresso-sombra {
          0%, 100% { transform:translate(-50%,-50%) scale(1); opacity:.5; }
          35%      { transform:translate(-50%,-50%) scale(.86); opacity:.34; }
          65%      { transform:translate(-50%,-50%) scale(.8); opacity:.28; }
        }
        /* o lustro passa uma vez por ciclo, na subida */
        @keyframes ingresso-lustro {
          0%, 22%   { transform:translateX(-130%); }
          58%, 100% { transform:translateX(130%); }
        }
        @keyframes item-esquerdo { 0%,100% { opacity:.62; margin-top:8px; } 50% { opacity:.9; margin-top:-3px; } }
        @keyframes item-direito { 0%,100% { opacity:.62; margin-top:-3px; } 50% { opacity:.9; margin-top:8px; } }
        @media (prefers-reduced-motion: reduce) {
          .premio-ingresso, .premio-bandeira, .premio-caneca, .ingresso-sombra { animation:none; }
          .premio-ingresso__brilho::after { animation:none; opacity:0; }
          /* parado, mas ainda no ar: o ângulo fica, o balanço some */
          .premio-ingresso { transform:rotateX(9deg) rotateZ(-3.5deg); }
        }
        @media (max-width:480px) {
          .premiacao-festival { padding-left:14px; padding-right:14px; }
          .premiacao-festival > div > div:last-child { height:352px; }
          /* laterais bem recuados: no celular eles só emolduram o ingresso */
          .premiacao-festival .premio-item { width:92px; height:124px; }
          .premiacao-festival .premio-item svg { width:38px; height:38px; margin-bottom:10px; }
          .premiacao-festival .premio-item span { font-size:9px; }
          /* o padding de baixo acompanha a altura do canhoto (78px + respiro),
             senão os dados do evento escorrem por cima do código de barras */
          .premiacao-festival .premio-ingresso { width:212px; height:274px; padding:16px 16px 86px; }
          .premiacao-festival .premio-ingresso__moldura { inset:7px; border-radius:9px; }
          .premiacao-festival .premio-ingresso__marca { font-size:9px; letter-spacing:.16em; }
          .premiacao-festival .premio-ingresso__filete { width:36px; margin-top:7px; }
          .premiacao-festival .premio-ingresso__label { margin-top:14px; font-size:9px; }
          .premiacao-festival .premio-ingresso__title { font-size:30px; }
          .premiacao-festival .premio-ingresso__sub { font-size:12px; letter-spacing:.26em; }
          .premiacao-festival .premio-ingresso__dados { gap:20px; margin-bottom:10px; }
          .premiacao-festival .premio-ingresso__dados > span { font-size:10px; }
          .premiacao-festival .premio-ingresso__canhoto { height:78px; gap:8px; }
          .premiacao-festival .premio-ingresso__picote { bottom:78px; }
          .premiacao-festival .premio-ingresso {
            -webkit-mask-image:
              radial-gradient(circle 7px at 0 calc(100% - 78px), transparent 97%, #000 100%),
              radial-gradient(circle 7px at 100% calc(100% - 78px), transparent 97%, #000 100%);
            mask-image:
              radial-gradient(circle 7px at 0 calc(100% - 78px), transparent 97%, #000 100%),
              radial-gradient(circle 7px at 100% calc(100% - 78px), transparent 97%, #000 100%);
          }
          .premiacao-festival .premio-ingresso__serie { font-size:8px; }
          .premiacao-festival .premio-ingresso__codigo { width:122px; height:26px; }
          .premiacao-festival .ingresso-sombra { width:166px; margin-top:160px; }
        }
      `}</style>
    </section>
  );
}
