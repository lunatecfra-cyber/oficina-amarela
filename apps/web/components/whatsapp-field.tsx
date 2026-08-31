"use client";

import { formatWhatsapp, isCompleteWhatsapp, onlyDigits } from "@oficina/domain/whatsapp";

// reexportado porque os formulários guardam só dígitos no estado
export { onlyDigits };

/**
 * Campo de WhatsApp — o contato direto entre porta-voz e editor.
 *
 * Guarda só dígitos no estado e mostra formatado: assim o mesmo número digitado
 * de três jeitos diferentes vira um valor só, e quem for montar o link
 * `wa.me/55...` depois não precisa limpar nada.
 */

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
