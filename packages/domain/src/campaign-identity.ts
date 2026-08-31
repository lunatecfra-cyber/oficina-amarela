/**
 * Os três dados que a lei eleitoral exige na tarja de propaganda.
 *
 * Fica no domínio porque a mesma validação roda no formulário do porta-voz e
 * na rota que grava o perfil — a tarja não pode ser montada com dado que o
 * servidor não validou.
 */
export type CampaignIdentity = {
  officialName: string;
  candidateNumber: string;
  campaignTaxId: string;
};

export type CampaignIdentityResult =
  | { ok: true; value: CampaignIdentity }
  | { ok: false; error: string };

export function validateCampaignIdentity(input: CampaignIdentity): CampaignIdentityResult {
  const value = {
    officialName: input.officialName.trim(),
    candidateNumber: input.candidateNumber.trim(),
    campaignTaxId: input.campaignTaxId.trim(),
  };

  if (!value.officialName) return { ok: false, error: "Informe o nome oficial." };
  if (!/^\d{2,5}$/.test(value.candidateNumber)) {
    return { ok: false, error: "Informe um número eleitoral de 2 a 5 dígitos." };
  }
  if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(value.campaignTaxId)) {
    return { ok: false, error: "Informe o CNPJ da campanha no formato 00.000.000/0000-00." };
  }

  return { ok: true, value };
}

export function buildCampaignStripText(input: CampaignIdentity): string {
  const result = validateCampaignIdentity(input);
  if (!result.ok) throw new Error(result.error);
  const value = result.value;
  return `PROPAGANDA ELEITORAL | ${value.officialName.toUpperCase()} | Nº ${value.candidateNumber} | CNPJ ${value.campaignTaxId}`;
}
