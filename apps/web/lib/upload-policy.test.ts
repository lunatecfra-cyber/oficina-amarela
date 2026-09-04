import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { uploadErrorMessage, validateRawMediaUpload } from "./upload-policy.ts";

describe("política de anexos brutos", () => {
  test("explica em português as falhas da rota de upload", () => {
    assert.equal(uploadErrorMessage(401), "Faça login para enviar arquivos.");
    assert.equal(uploadErrorMessage(400), "Informe o nome e o formato do arquivo.");
    assert.equal(uploadErrorMessage(500), "Não foi possível preparar o upload. Tente de novo.");
  });

  test("aceita vídeo de até 2 GB", () => {
    assert.deepEqual(validateRawMediaUpload("video/mp4", 2 * 1024 ** 3), {
      ok: true,
      kind: "video",
    });
  });

  test("aceita foto de até 20 MB", () => {
    assert.deepEqual(validateRawMediaUpload("image/jpeg", 20 * 1024 ** 2), {
      ok: true,
      kind: "image",
    });
  });

  test("recusa foto acima de 20 MB", () => {
    const result = validateRawMediaUpload("image/png", 20 * 1024 ** 2 + 1);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 413);
  });

  test("recusa formato não permitido", () => {
    const result = validateRawMediaUpload("application/pdf", 1024);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 415);
  });
});
