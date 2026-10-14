export function inspectionDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Não informado";
  const date = new Date(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? date.toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : date.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function inspectionWait(value: string | null, now = Date.now()) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Tempo de espera não informado";
  const hours = Math.max(0, Math.floor((now - Date.parse(value)) / 3600000));
  return hours === 0 ? "Há menos de uma hora" : `Há ${hours} hora(s)`;
}
