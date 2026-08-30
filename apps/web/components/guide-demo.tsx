import type { Demo, GuideDemoType } from "@/lib/guide";

const CYCLE = { drive: 9.6, delivery: 7.2, entrega: 7.2 } as const;

function Scene({
  index,
  total,
  cycle,
  children,
}: {
  index: number;
  total: number;
  cycle: number;
  children: React.ReactNode;
}) {
  return (
    <div className="guia-cena" style={{ animationDelay: `${-(cycle - (cycle / total) * index)}s` }}>
      {children}
    </div>
  );
}

function Caption({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="text-center text-[11px] leading-snug text-muted">
      <span className="mr-1 font-semibold text-gold">{n}.</span>
      {children}
    </p>
  );
}

function Folder({ label }: { label: string }) {
  return (
    <div className="w-[150px] rounded-lg border border-line bg-surface/80 p-2">
      <p className="mb-1.5 truncate text-[10px] text-muted-2">📁 {label}</p>
      <div className="flex flex-col gap-1">
        {[100, 74, 88].map((w, i) => (
          <span
            key={i}
            className="h-1.5 rounded-full bg-gradient-to-r from-gold-lo/70 to-gold-lo/20"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function FakeButton({ text, withFinger }: { text: string; withFinger?: boolean }) {
  return (
    <span className="relative inline-flex items-center rounded-lg bg-gradient-to-b from-gold-hi to-gold-lo px-3 py-1.5 text-[11px] font-semibold text-black/80">
      {text}
      {withFinger && (
        <span aria-hidden="true" className="guia-toque absolute -bottom-3 -right-3 text-base">
          👆
        </span>
      )}
    </span>
  );
}

function AccessSelector() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="rounded-md border border-line bg-ink-2 px-2 py-1 text-[10px] text-muted-2 line-through">
        🔒 Restrito
      </span>
      <span aria-hidden="true" className="text-[10px] text-gold">
        ↓
      </span>
      <span className="rounded-md border border-gold-lo/60 bg-gold/10 px-2 py-1 text-[10px] font-medium text-gold-hi">
        🔗 Qualquer pessoa com o link
      </span>
    </div>
  );
}

function PastedField({ button }: { button?: string }) {
  return (
    <div className="flex w-[170px] flex-col gap-1.5">
      <span className="flex items-center gap-1 rounded-lg border border-gold/50 bg-surface px-2 py-1.5 text-[10px] text-text">
        <span className="truncate">drive.google.com/…</span>
        <span className="text-ok">✓</span>
      </span>
      {button && <FakeButton text={button} />}
    </div>
  );
}

export function GuideDemo({
  type,
  tipo,
}: {
  type?: GuideDemoType | Demo | string;
  tipo?: GuideDemoType | Demo | string;
}) {
  const effectiveType = type ?? tipo ?? "drive";

  if (effectiveType === "drive") {
    const c = CYCLE.drive;
    return (
      <div className="guia-palco mt-3" data-cenas="4" aria-hidden="true">
        <Scene index={0} total={4} cycle={c}>
          <Folder label="Brutos da semana" />
          <Caption n={1}>Suba o vídeo na sua pasta do Drive</Caption>
        </Scene>
        <Scene index={1} total={4} cycle={c}>
          <FakeButton text="Compartilhar" withFinger />
          <Caption n={2}>Abra a pasta e toque em Compartilhar</Caption>
        </Scene>
        <Scene index={2} total={4} cycle={c}>
          <AccessSelector />
          <Caption n={3}>Troque de “Restrito” pra “qualquer pessoa”</Caption>
        </Scene>
        <Scene index={3} total={4} cycle={c}>
          <PastedField />
          <Caption n={4}>Copie o link e cole aqui</Caption>
        </Scene>
      </div>
    );
  }

  const c = CYCLE.delivery;
  return (
    <div className="guia-palco mt-3" data-cenas="3" aria-hidden="true">
      <Scene index={0} total={3} cycle={c}>
        <Folder label="Meus vídeos prontos" />
        <Caption n={1}>O vídeo pronto sobe no SEU Drive</Caption>
      </Scene>
      <Scene index={1} total={3} cycle={c}>
        <AccessSelector />
        <Caption n={2}>Libere pra quem tem o link</Caption>
      </Scene>
      <Scene index={2} total={3} cycle={c}>
        <PastedField button="Confirmar entrega" />
        <Caption n={3}>Cole aqui e confirme</Caption>
      </Scene>
    </div>
  );
}

export { GuideDemo as DemoGuia };
