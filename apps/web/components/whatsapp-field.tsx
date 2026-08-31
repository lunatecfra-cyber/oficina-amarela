"use client";

/**
 * Campo de WhatsApp — o contato direto entre porta-voz e editor.
 *
 * Guarda só dígitos no estado e mostra formatado: assim o mesmo número digitado
 * de três jeitos diferentes vira um valor só, e quem for montar o link
 * `wa.me/55...` depois não precisa limpar nada.
 */

/** Deixa só os números e corta no tamanho de um celular com DDD. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** 11987654321 → (11) 98765-4321 */
export function formatWhatsapp(digits: string): string {
  const d = onlyDigits(digits);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** 10 dígitos (fixo com DDD) ou 11 (celular). Menos que isso não disca. */
export function isCompleteWhatsapp(digits: string): boolean {
  const d = onlyDigits(digits);
  return d.length === 10 || d.length === 11;
}

export function WhatsappField({
  value,
  onChange,
  labelClassName = "mb-2 block text-xs font-medium uppercase tracking-[0.1em] text-muted",
  hint,
}: {
  /** só dígitos */
  value: string;
  onChange: (digits: string) => void;
  labelClassName?: string;
  hint?: string;
}) {
  const incomplete = value.length > 0 && !isCompleteWhatsapp(value);

  return (
    <div>
      <label htmlFor="whatsapp" className={labelClassName}>
        WhatsApp <span className="text-muted-2">(opcional)</span>
      </label>
      <input
        id="whatsapp"
        name="whatsapp"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className="field-input !pl-4"
        placeholder="(11) 98765-4321"
        value={formatWhatsapp(value)}
        onChange={(e) => onChange(onlyDigits(e.target.value))}
        aria-describedby="whatsapp-ajuda"
      />
      <p id="whatsapp-ajuda" className="mt-1.5 text-xs leading-relaxed text-muted-2">
        {incomplete
          ? "Faltam dígitos — coloque o DDD e o número."
          : (hint ?? "Com DDD. Fica visível pra quem estiver na mesma missão que você.")}
      </p>
    </div>
  );
}
