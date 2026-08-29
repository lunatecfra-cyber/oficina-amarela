"use client";

export function LegalNotice() {
  return (
    <div className="mb-6 rounded-xl border border-gold/30 bg-gold/5 p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-24 h-24 text-gold">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <div className="relative z-10 flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-gold/20 p-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5 text-gold">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-gold">Diretrizes Obrigatórias do TSE</h3>
          <p className="mt-1 text-sm text-silver-lo">
            Lembre-se: todo material de campanha precisa obrigatoriamente exibir a <strong>Marca d&apos;água</strong> e o <strong>CNPJ da campanha</strong> no vídeo. Preencha os campos abaixo para que o editor insira essas informações na edição.
          </p>
        </div>
      </div>
    </div>
  );
}

export { LegalNotice as AvisoTse };
