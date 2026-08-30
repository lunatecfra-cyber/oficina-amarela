import assert from "node:assert/strict";
import test from "node:test";

test("candidate profile requires official name, electoral number and campaign CNPJ", async () => {
  const campaignIdentity = await import("./campaign-identity.ts").catch(() => null);
  assert.ok(campaignIdentity, "campaign identity validation must exist");

  const missingNumber = campaignIdentity.validateCampaignIdentity({
    officialName: "Eduardo Gabriel",
    campaignTaxId: "68.728.863/0001-13",
    candidateNumber: "",
  });
  assert.equal(missingNumber.ok, false);

  const missingCnpj = campaignIdentity.validateCampaignIdentity({
    officialName: "Eduardo Gabriel",
    campaignTaxId: "",
    candidateNumber: "13",
  });
  assert.equal(missingCnpj.ok, false);

  const valid = campaignIdentity.validateCampaignIdentity({
    officialName: "  Eduardo Gabriel  ",
    campaignTaxId: "68.728.863/0001-13",
    candidateNumber: " 13 ",
  });
  assert.deepEqual(valid, {
    ok: true,
    value: {
      officialName: "Eduardo Gabriel",
      candidateNumber: "13",
      campaignTaxId: "68.728.863/0001-13",
    },
  });
});

test("campaign strip text uses normalized profile data", async () => {
  const campaignIdentity = await import("./campaign-identity.ts").catch(() => null);
  assert.ok(campaignIdentity, "campaign strip text builder must exist");
  assert.equal(
    campaignIdentity.buildCampaignStripText({
      officialName: "  Eduardo Gabriel  ",
      candidateNumber: " 13 ",
      campaignTaxId: "68.728.863/0001-13",
    }),
    "PROPAGANDA ELEITORAL | EDUARDO GABRIEL | Nº 13 | CNPJ 68.728.863/0001-13",
  );
});
