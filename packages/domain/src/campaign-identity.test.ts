import assert from "node:assert/strict";
import test, { describe } from "node:test";
import { buildCampaignStripText, validateCampaignIdentity } from "./campaign-identity.ts";

describe("identidade de campanha", () => {
  test("número eleitoral é obrigatório", () => {
    const result = validateCampaignIdentity({
      officialName: "Eduardo Gabriel",
      campaignTaxId: "68.728.863/0001-13",
      candidateNumber: "",
    });
    assert.equal(result.ok, false);
  });

  test("número eleitoral fora de 2 a 5 dígitos é recusado", () => {
    for (const candidateNumber of ["1", "123456", "1a", "12.3"]) {
      const result = validateCampaignIdentity({
        officialName: "Eduardo Gabriel",
        campaignTaxId: "68.728.863/0001-13",
        candidateNumber,
      });
      assert.equal(result.ok, false, `deveria recusar ${candidateNumber}`);
    }
  });

  test("CNPJ da campanha é obrigatório e formatado", () => {
    for (const campaignTaxId of ["", "68728863000113", "68.728.863/0001"]) {
      const result = validateCampaignIdentity({
        officialName: "Eduardo Gabriel",
        campaignTaxId,
        candidateNumber: "13",
      });
      assert.equal(result.ok, false, `deveria recusar ${campaignTaxId}`);
    }
  });

  test("nome oficial só com espaço é recusado", () => {
    const result = validateCampaignIdentity({
      officialName: "   ",
      campaignTaxId: "68.728.863/0001-13",
      candidateNumber: "13",
    });
    assert.equal(result.ok, false);
  });

  test("entrada válida volta sem espaço sobrando", () => {
    assert.deepEqual(
      validateCampaignIdentity({
        officialName: "  Eduardo Gabriel  ",
        campaignTaxId: "68.728.863/0001-13",
        candidateNumber: " 13 ",
      }),
      {
        ok: true,
        value: {
          officialName: "Eduardo Gabriel",
          candidateNumber: "13",
          campaignTaxId: "68.728.863/0001-13",
        },
      },
    );
  });
});

describe("tarja de propaganda eleitoral", () => {
  test("monta a tarja com o dado já normalizado", () => {
    assert.equal(
      buildCampaignStripText({
        officialName: "  Eduardo Gabriel  ",
        candidateNumber: " 13 ",
        campaignTaxId: "68.728.863/0001-13",
      }),
      "PROPAGANDA ELEITORAL | EDUARDO GABRIEL | Nº 13 | CNPJ 68.728.863/0001-13",
    );
  });

  // A tarja é obrigação legal: montar com dado inválido publicaria propaganda
  // irregular, então falhar alto é melhor que emitir texto pela metade.
  test("recusa montar a tarja com dado inválido", () => {
    assert.throws(() =>
      buildCampaignStripText({
        officialName: "Eduardo Gabriel",
        candidateNumber: "",
        campaignTaxId: "68.728.863/0001-13",
      }),
    );
  });
});
