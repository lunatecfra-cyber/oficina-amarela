import assert from "node:assert/strict";
import test from "node:test";
import { isValidPhoto, MAX_PHOTO_BYTES } from "./limits.ts";

test("foto exige data URL base64 com assinatura correspondente e tamanho limitado", () => {
  assert.equal(isValidPhoto(null), true);
  assert.equal(isValidPhoto("data:image/png;base64,iVBORw0KGgo="), true);
  assert.equal(isValidPhoto("data:image/jpeg;base64,/9j/4AAQSkZJRg=="), true);
  assert.equal(isValidPhoto("data:image/gif;base64,R0lGODlh"), true);
  assert.equal(isValidPhoto("data:image/webp;base64,UklGRgAAAABXRUJQ"), true);
  assert.equal(isValidPhoto("data:image/png;base64,/9j/4AAQSkZJRg=="), false);
  assert.equal(isValidPhoto("data:image/png-not-an-image"), false);
  assert.equal(isValidPhoto("data:image/png;base64,!!!!"), false);
  assert.equal(isValidPhoto(`data:image/png;base64,${"A".repeat(MAX_PHOTO_BYTES)}`), false);
  assert.equal(isValidPhoto({} as string), false);
  assert.equal(isValidPhoto(0 as unknown as string), false);
});
