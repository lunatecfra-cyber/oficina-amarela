const CYCLE = 15;
const SCENES = 5;

const delay = (k: number) => `${-(CYCLE - (CYCLE / SCENES) * k)}s`;

function Scene({ k, children }: { k: number; children: React.ReactNode }) {
  return (
    <div className="cast-cena" style={{ animationDelay: delay(k) }}>
      {children}
    </div>
  );
}

function Cursor({ path, k }: { path: string; k: number }) {
  return (
    <svg
      className="cast-cursor"
      viewBox="0 0 12 17"
      aria-hidden="true"
      style={{ animationName: path, animationDelay: delay(k) }}
    >
      <path d="M1 1l10 7-4.2.9 2.5 5-2.1 1-2.5-5L1 13z" fill="#fff" stroke="#111" strokeWidth="1" />
    </svg>
  );
}

function Caption({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="cast-legenda">
      <b>{n}.</b> {children}
    </p>
  );
}

function Window({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="cast-janela">
      <div className="cast-barra">
        <span aria-hidden="true">📁</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function FileItem({ name, target }: { name: string; target?: boolean }) {
  return (
    <div className={`cast-linha${target ? " cast-linha--alvo" : ""}`}>
      <span aria-hidden="true">🎬</span>
      <span className="truncate">{name}</span>
    </div>
  );
}

export function ScreencastDrive() {
  return (
    <div>
      <div className="cast" aria-hidden="true">
        {/* 1 */}
        <Scene k={0}>
          <Window title="Brutos da semana">
            <FileItem name="bairro-01.mp4" />
            <FileItem name="bairro-02.mp4" />
            <div className="cast-linha" style={{ color: "#5f6368" }}>
              <span aria-hidden="true">⬆</span>
              <span>enviando…</span>
            </div>
          </Window>
          <Caption n={1}>Suba o vídeo na sua pasta do Drive</Caption>
        </Scene>

        {/* 2 */}
        <Scene k={1}>
          <Window title="Brutos da semana">
            <FileItem name="bairro-01.mp4" />
            <FileItem name="bairro-02.mp4" target />
            <div
              className="cast-surge"
              style={{
                animationDelay: delay(1),
                position: "absolute",
                left: "30%",
                top: "56%",
                width: 118,
                borderRadius: 6,
                background: "#fff",
                boxShadow: "0 6px 18px rgba(0,0,0,.28)",
                border: "1px solid #e3e3e6",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "5px 9px", color: "#5f6368" }}>Abrir</div>
              <div
                style={{
                  padding: "5px 9px",
                  background: "#e8f0fe",
                  color: "#1967d2",
                  fontWeight: 600,
                }}
              >
                Compartilhar
              </div>
              <div style={{ padding: "5px 9px", color: "#5f6368" }}>Renomear</div>
            </div>
          </Window>
          <Cursor path="cast-ate-arquivo" k={1} />
          <Caption n={2}>Toque no arquivo e escolha Compartilhar</Caption>
        </Scene>

        {/* 3 */}
        <Scene k={2}>
          <div className="cast-janela">
            <div className="cast-barra">Compartilhar “bairro-02.mp4”</div>
            <div style={{ padding: "8px 9px", color: "#5f6368" }}>Acesso geral</div>
            <div className="cast-linha" style={{ gap: 6 }}>
              <span aria-hidden="true">🔒</span>
              <span style={{ textDecoration: "line-through", color: "#80868b" }}>Restrito</span>
              <span style={{ color: "#1967d2" }}>▾</span>
            </div>
            <div
              className="cast-surge"
              style={{
                animationDelay: delay(2),
                margin: "0 9px",
                borderRadius: 6,
                border: "1px solid #e3e3e6",
                background: "#fff",
                boxShadow: "0 6px 18px rgba(0,0,0,.28)",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "5px 9px", color: "#5f6368" }}>Restrito</div>
              <div
                style={{
                  padding: "5px 9px",
                  background: "#e6f4ea",
                  color: "#137333",
                  fontWeight: 600,
                }}
              >
                ✓ Qualquer pessoa com o link
              </div>
            </div>
          </div>
          <Cursor path="cast-ate-acesso" k={2} />
          <Caption n={3}>Troque de “Restrito” para “qualquer pessoa com o link”</Caption>
        </Scene>

        {/* 4 */}
        <Scene k={3}>
          <div className="cast-janela">
            <div className="cast-barra">Compartilhar “bairro-02.mp4”</div>
            <div className="cast-linha" style={{ gap: 6 }}>
              <span aria-hidden="true">🔗</span>
              <span style={{ color: "#137333", fontWeight: 600 }}>Qualquer pessoa com o link</span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 9px" }}>
              <span
                style={{
                  borderRadius: 999,
                  background: "#1a73e8",
                  color: "#fff",
                  padding: "5px 12px",
                  fontWeight: 600,
                }}
              >
                Copiar link
              </span>
            </div>
            <div
              className="cast-surge"
              style={{
                animationDelay: delay(3),
                margin: "0 9px",
                borderRadius: 6,
                background: "#202124",
                color: "#fff",
                padding: "5px 9px",
              }}
            >
              ✓ Link copiado
            </div>
          </div>
          <Cursor path="cast-ate-copiar" k={3} />
          <Caption n={4}>Copie o link</Caption>
        </Scene>

        {/* 5 */}
        <Scene k={4}>
          <div
            style={{
              position: "absolute",
              inset: "8px 8px 30px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 8,
              borderRadius: 8,
              border: "1px solid var(--color-line)",
              background: "var(--color-surface)",
              padding: 14,
            }}
          >
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Link do Drive com o bruto
            </span>
            <span className="flex items-center gap-2 rounded-lg border border-gold/60 bg-ink-2 px-2 py-2 text-[11px] text-text">
              <span className="truncate">drive.google.com/file/d/…</span>
              <span className="text-ok">✓</span>
            </span>
          </div>
          <Caption n={5}>Cole aqui na Oficina — pronto</Caption>
        </Scene>
      </div>

      <div className="cast-regua" aria-hidden="true">
        {Array.from({ length: SCENES }, (_, k) => (
          <span key={k} className="cast-tic">
            <span style={{ animationDelay: delay(k) }} />
          </span>
        ))}
      </div>
    </div>
  );
}
