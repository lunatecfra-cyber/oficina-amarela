/**
 * WhatsApp: o contato direto entre porta-voz e editor de uma mesma missão.
 *
 * Guardamos só dígitos. O mesmo número digitado de três jeitos — com traço,
 * com parênteses, com espaço — vira um valor só, e quem for montar o link
 * `wa.me/55...` depois não precisa limpar nada.
 *
 * A normalização mora no domínio, e não no campo do formulário, porque o
 * servidor também precisa dela: o formulário é conveniência, a rota é a
 * fronteira. Sem isto o banco aceitaria "meu zap é 9999" como telefone.
 */

/**
 * Deixa só os números e corta no tamanho de um celular com DDD.
 *
 * O 55 do começo cai antes do corte. Número brasileiro tem 10 ou 11 dígitos
 * com DDD, então 12 ou 13 só acontece com código de país junto — e aí cortar
 * os 11 primeiros de "+55 11 98765-4321" guardaria "55119876543", que tem o
 * tamanho certo, passa na validação e não é o telefone de ninguém.
 */
export function onlyDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
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

/**
 * O que vai pro banco: dígitos completos, ou `null`.
 *
 * O campo é opcional, então vazio é `null` — mas número pela metade também é
 * `null`, e não um telefone quebrado guardado como se servisse. Melhor não ter
 * contato do que ter um que não disca.
 */
export function normalizeWhatsapp(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = onlyDigits(value);
  return isCompleteWhatsapp(digits) ? digits : null;
}
