import assert from "node:assert/strict";
import test from "node:test";
import { publishedPortfolioLink } from "./validators.ts";

test("portfólio público omite arquivos privados, assinatura e protocolos executáveis", () => {
  for (const value of [
    null,
    "not a URL",
    "javascript:alert(1)",
    "https://staging.local/api/missions/39/files/private",
    "https://r2.example.invalid/video?X-Amz-Signature=secret",
    "https://r2.example.invalid/video?x-amz-signature=secret",
  ])
    assert.equal(publishedPortfolioLink(value), null);
  assert.equal(
    publishedPortfolioLink("https://example.invalid/portfolio"),
    "https://example.invalid/portfolio",
  );
});
