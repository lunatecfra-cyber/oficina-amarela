export function FestivalAwards() {
  return (
    <section
      className="premiacao-festival border-y border-gold-lo/20 px-6 py-12 lg:py-16"
      aria-labelledby="premiacao-titulo"
    >
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-gold-lo">Premiação especial</p>
          <h2 id="premiacao-titulo" className="mt-3 max-w-md font-[family-name:var(--font-display)] text-3xl font-semibold leading-tight text-text lg:text-5xl">
            O topo leva você ao festival.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted lg:text-base">
            Na produção do vídeo de honra e da edição, quem mais se destacar
            chega ao prêmio principal.
          </p>
        </div>

        <div className="relative mx-auto h-80 w-full max-w-lg" aria-label="Premiação: primeiro lugar ganha ingresso; segundo e terceiro ganham presentes misteriosos">
          <div className="premio-item premio-bandeira" aria-hidden="true">
            <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M16 52V10m0 2h29l-8 9 8 9H16" />
              <path d="M10 52h14" />
            </svg>
            <span>2º lugar</span>
          </div>

          <div className="premio-ingresso">
            <span className="premio-ingresso__label">1º lugar</span>
            <span className="premio-ingresso__title">INGRESSO</span>
            <span className="premio-ingresso__sub">FESTIVAL</span>
            <span className="premio-ingresso__line" />
            <span className="premio-ingresso__foot">Prêmio principal</span>
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
        .premio-ingresso { position:absolute; left:50%; top:50%; z-index:2; display:flex; width:212px; height:258px; transform:translate(-50%,-50%); flex-direction:column; align-items:center; justify-content:center; border:2px solid rgba(244,206,31,.82); border-radius:14px; background:linear-gradient(145deg,#f7d92e,#d8b51a); color:#101216; box-shadow:0 22px 55px rgba(0,0,0,.5), 0 0 42px rgba(244,206,31,.2); animation: ingresso-subindo 4.8s ease-in-out infinite; }
        .premio-ingresso::before, .premio-ingresso::after { content:""; position:absolute; top:50%; width:20px; height:20px; transform:translateY(-50%); border-radius:50%; background:#111419; }
        .premio-ingresso::before { left:-11px; } .premio-ingresso::after { right:-11px; }
        .premio-ingresso::marker { content:""; }
        .premio-ingresso__label { font-size:10px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; }
        .premio-ingresso__title { margin-top:17px; font-family:Georgia,serif; font-size:31px; font-weight:800; letter-spacing:.04em; }
        .premio-ingresso__sub { font-size:15px; font-weight:800; letter-spacing:.28em; }
        .premio-ingresso__line { width:78%; margin:20px 0 11px; border-top:2px dashed rgba(16,18,22,.6); }
        .premio-ingresso__foot { font-size:10px; font-weight:700; text-transform:uppercase; }
        .premio-item { position:absolute; top:50%; display:flex; width:148px; height:184px; transform:translateY(-50%); flex-direction:column; align-items:center; justify-content:center; border:1px solid #4a4e54; border-radius:12px; background:linear-gradient(145deg,#24282e,#14171b); color:#9da2aa; box-shadow:0 16px 32px rgba(0,0,0,.34); }
        .premio-item svg { width:66px; height:66px; margin-bottom:16px; }
        .premio-item span { font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
        .premio-bandeira { left:0; transform:translateY(-50%) rotate(-8deg); animation: item-esquerdo 4.8s ease-in-out infinite; }
        .premio-caneca { right:0; transform:translateY(-50%) rotate(8deg); animation: item-direito 4.8s ease-in-out infinite; }
        @keyframes ingresso-subindo { 0%,100% { margin-top:10px; } 50% { margin-top:-10px; } }
        @keyframes item-esquerdo { 0%,100% { opacity:.62; margin-top:8px; } 50% { opacity:.9; margin-top:-3px; } }
        @keyframes item-direito { 0%,100% { opacity:.62; margin-top:-3px; } 50% { opacity:.9; margin-top:8px; } }
        @media (prefers-reduced-motion: reduce) { .premio-ingresso, .premio-bandeira, .premio-caneca { animation:none; } }
        @media (max-width:480px) { .premiacao-festival { padding-left:14px; padding-right:14px; } .premiacao-festival > div > div:last-child { height:250px; } .premiacao-festival .premio-item { width:108px; height:142px; } .premiacao-festival .premio-ingresso { width:158px; height:210px; } .premiacao-festival .premio-item svg { width:46px; height:46px; } .premiacao-festival .premio-ingresso__title { font-size:23px; } .premiacao-festival .premio-ingresso__sub { font-size:11px; } }
      `}</style>
    </section>
  );
}

export { FestivalAwards as PremiacaoFestival };
