/**
 * A "gravação de tela" do Drive — que não é vídeo nenhum.
 *
 * Cinco cenas encenando o caminho inteiro: subir o arquivo, abrir o menu,
 * trocar o acesso, copiar o link e colar na Oficina. Um cursor de mentira
 * anda até cada botão antes de o menu abrir, que é o que faz parecer
 * gravação em vez de slide.
 *
 * Por que não é vídeo: vídeo precisaria ser gravado numa conta de Drive de
 * verdade, hospedado em algum lugar e regravado toda vez que o Google mudar
 * um botão de canto. Isto pesa alguns bytes, funciona sem rede e se conserta
 * editando texto. Quando existir vídeo de verdade, ele entra por
 * lib/tutoriais.ts e esta demonstração sai de cena sozinha.
 *
 * O ritmo é todo do CSS (`.cast` no globals.css). Aqui só entram as cenas e
 * o atraso de cada uma.
 */

const CICLO = 15;
const CENAS = 5;

/** atraso negativo: a cena k já entra no ciclo rodada até o ponto dela */
const atraso = (k: number) => `${-(CICLO - (CICLO / CENAS) * k)}s`;

function Cena({ k, children }: { k: number; children: React.ReactNode }) {
  return (
    <div className="cast-cena" style={{ animationDelay: atraso(k) }}>
      {children}
    </div>
  );
}

function Cursor({ percurso, k }: { percurso: string; k: number }) {
  return (
    <svg
      className="cast-cursor"
      viewBox="0 0 12 17"
      aria-hidden="true"
      style={{ animationName: percurso, animationDelay: atraso(k) }}
    >
      <path d="M1 1l10 7-4.2.9 2.5 5-2.1 1-2.5-5L1 13z" fill="#fff" stroke="#111" strokeWidth="1" />
    </svg>
  );
}

function Legenda({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="cast-legenda">
      <b>{n}.</b> {children}
    </p>
  );
}

function Janela({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="cast-janela">
      <div className="cast-barra">
        <span aria-hidden="true">📁</span>
        {titulo}
      </div>
      {children}
    </div>
  );
}

function Arquivo({ nome, alvo }: { nome: string; alvo?: boolean }) {
  return (
    <div className={`cast-linha${alvo ? " cast-linha--alvo" : ""}`}>
      <span aria-hidden="true">🎬</span>
      <span className="truncate">{nome}</span>
    </div>
  );
}

export function ScreencastDrive() {
  return (
    <div>
      <div className="cast" aria-hidden="true">
        {/* 1 — o arquivo sobe pra pasta */}
        <Cena k={0}>
          <Janela titulo="Brutos da semana">
            <Arquivo nome="bairro-01.mp4" />
            <Arquivo nome="bairro-02.mp4" />
            <div className="cast-linha" style={{ color: "#5f6368" }}>
              <span aria-hidden="true">⬆</span>
              <span>enviando…</span>
            </div>
          </Janela>
          <Legenda n={1}>Suba o vídeo na sua pasta do Drive</Legenda>
        </Cena>

        {/* 2 — botão direito no arquivo, menu abre */}
        <Cena k={1}>
          <Janela titulo="Brutos da semana">
            <Arquivo nome="bairro-01.mp4" />
            <Arquivo nome="bairro-02.mp4" alvo />
            <div
              className="cast-surge"
              style={{
                animationDelay: atraso(1),
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
          </Janela>
          <Cursor percurso="cast-ate-arquivo" k={1} />
          <Legenda n={2}>Toque no arquivo e escolha Compartilhar</Legenda>
        </Cena>

        {/* 3 — o acesso sai de Restrito */}
        <Cena k={2}>
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
                animationDelay: atraso(2),
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
          <Cursor percurso="cast-ate-acesso" k={2} />
          <Legenda n={3}>Troque de “Restrito” para “qualquer pessoa com o link”</Legenda>
        </Cena>

        {/* 4 — copiar o link */}
        <Cena k={3}>
          <div className="cast-janela">
            <div className="cast-barra">Compartilhar “bairro-02.mp4”</div>
            <div className="cast-linha" style={{ gap: 6 }}>
              <span aria-hidden="true">🔗</span>
              <span style={{ color: "#137333", fontWeight: 600 }}>
                Qualquer pessoa com o link
              </span>
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
                animationDelay: atraso(3),
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
          <Cursor percurso="cast-ate-copiar" k={3} />
          <Legenda n={4}>Copie o link</Legenda>
        </Cena>

        {/* 5 — de volta à Oficina, colando */}
        <Cena k={4}>
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
          <Legenda n={5}>Cole aqui na Oficina — pronto</Legenda>
        </Cena>
      </div>

      <div className="cast-regua" aria-hidden="true">
        {Array.from({ length: CENAS }, (_, k) => (
          <span key={k} className="cast-tic">
            <span style={{ animationDelay: atraso(k) }} />
          </span>
        ))}
      </div>
    </div>
  );
}
