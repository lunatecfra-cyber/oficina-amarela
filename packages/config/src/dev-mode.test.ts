// Os portões de desenvolvimento precisam falhar fechados. O caso que interessa
// é o build sem NODE_ENV: antes, o portão inteiro dependia dele.

import assert from "node:assert/strict";
import test, { afterEach, describe } from "node:test";
import {
  DEMO_CONTENT_ENV,
  DEV_AUTH_BYPASS_ENV,
  isDemoContentEnabled,
  isDevAuthBypassEnabled,
} from "./dev-mode.ts";

// process.env.NODE_ENV é readonly nos tipos do Next; aqui precisamos escrever.
const env = process.env as Record<string, string | undefined>;

const original = {
  NODE_ENV: process.env.NODE_ENV,
  [DEV_AUTH_BYPASS_ENV]: process.env[DEV_AUTH_BYPASS_ENV],
  [DEMO_CONTENT_ENV]: process.env[DEMO_CONTENT_ENV],
};

function setEnv(nodeEnv: string | undefined, flags: Record<string, string | undefined>) {
  if (nodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = nodeEnv;

  for (const name of [DEV_AUTH_BYPASS_ENV, DEMO_CONTENT_ENV]) {
    const value = flags[name];
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
}

afterEach(() => {
  for (const [name, value] of Object.entries(original)) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
});

describe("portões de desenvolvimento", () => {
  test("produção nunca libera, nem com a variável ligada", () => {
    setEnv("production", { [DEV_AUTH_BYPASS_ENV]: "1", [DEMO_CONTENT_ENV]: "1" });
    assert.equal(isDevAuthBypassEnabled(), false);
    assert.equal(isDemoContentEnabled(), false);
  });

  test("fora de produção, sem a variável, segue fechado", () => {
    setEnv("development", {});
    assert.equal(isDevAuthBypassEnabled(), false);
    assert.equal(isDemoContentEnabled(), false);
  });

  test("fora de produção, com a variável, libera", () => {
    setEnv("development", { [DEV_AUTH_BYPASS_ENV]: "1", [DEMO_CONTENT_ENV]: "1" });
    assert.equal(isDevAuthBypassEnabled(), true);
    assert.equal(isDemoContentEnabled(), true);
  });

  test("build sem NODE_ENV continua fechado por padrão", () => {
    setEnv(undefined, {});
    assert.equal(isDevAuthBypassEnabled(), false);
    assert.equal(isDemoContentEnabled(), false);
  });

  test("só o valor exato '1' abre o portão", () => {
    for (const value of ["true", "yes", "0", "", "01"]) {
      setEnv("development", { [DEV_AUTH_BYPASS_ENV]: value });
      assert.equal(
        isDevAuthBypassEnabled(),
        false,
        `valor ${JSON.stringify(value)} não pode abrir`,
      );
    }
  });

  test("os dois portões são independentes", () => {
    setEnv("development", { [DEV_AUTH_BYPASS_ENV]: "1" });
    assert.equal(isDevAuthBypassEnabled(), true);
    assert.equal(isDemoContentEnabled(), false);

    setEnv("development", { [DEMO_CONTENT_ENV]: "1" });
    assert.equal(isDevAuthBypassEnabled(), false);
    assert.equal(isDemoContentEnabled(), true);
  });
});
