import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);

// Execute component handlers with persistent hook slots, without adding a DOM/test dependency.
function fixture() {
  const slots = [];
  let cursor = 0;
  let refreshes = 0;
  let reloads = 0;
  const calls = [];
  const responses = [];
  const state = {
    controls: {
      canCancel: true,
      canReassign: true,
      cancelled: false,
      reassignAvailableAt: null,
      version: 4,
    },
    loading: false,
    error: "",
    reload: async () => {
      reloads++;
    },
  };
  const hooks = {
    createContext: () => ({}),
    useContext: () => state,
    useId: () => "owner-test",
    useCallback: (fn) => fn,
    useEffect: () => {},
    useState: (initial) => {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = initial;
      return [
        slots[slot],
        (value) => {
          slots[slot] = value;
        },
      ];
    },
    useRef: (initial) => {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
  };
  const source = readFileSync(new URL("./owner-mission-controls.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) =>
      name === "react"
        ? hooks
        : name === "next/navigation"
          ? {
              useRouter: () => ({
                refresh: () => {
                  refreshes++;
                },
              }),
            }
          : require(name),
    crypto: globalThis.crypto,
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const result = responses.shift();
      if (result instanceof Error) throw result;
      return result ?? { ok: true, status: 200 };
    },
  });
  const render = () => {
    cursor = 0;
    return exports.OwnerMissionActions({ id: "db-12" });
  };
  function nodes(tree, type) {
    if (!tree || typeof tree !== "object") return [];
    if (Array.isArray(tree)) return tree.flatMap((node) => nodes(node, type));
    return [...(tree.type === type ? [tree] : []), ...nodes(tree.props?.children, type)];
  }
  const button = (label) => nodes(render(), "button").find((node) => node.props.children === label);
  const edit = (reason) =>
    nodes(render(), "textarea")[0].props.onChange({ target: { value: reason } });
  const submit = async () => {
    nodes(render(), "form")[0].props.onSubmit({ preventDefault() {} });
    await new Promise(setImmediate);
  };
  async function open(action = "Cancelar missão") {
    nodes(render(), "button")[0].props.onClick();
    await new Promise(setImmediate);
    button(action).props.onClick();
  }
  return {
    state,
    calls,
    responses,
    render,
    nodes,
    button,
    edit,
    submit,
    open,
    counts: () => ({ refreshes, reloads }),
  };
}

test("network retry retains reason, UUID, version and payload", async () => {
  const f = fixture();
  await f.open();
  f.edit("  Motivo registrado  ");
  f.responses.push(new Error("offline"));
  await f.submit();
  assert.equal(f.nodes(f.render(), "textarea")[0].props.value, "  Motivo registrado  ");
  await f.submit();
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].headers["idempotency-key"], f.calls[1].headers["idempotency-key"]);
  assert.match(
    f.calls[0].headers["idempotency-key"],
    /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,
  );
  assert.equal(f.calls[0].body, f.calls[1].body);
  assert.deepEqual(JSON.parse(f.calls[0].body), {
    action: "cancel_mission",
    reason: "Motivo registrado",
    version: 4,
  });
  assert.equal(f.calls[0].url, "/api/missions/db-12");
});

test("409 refreshes and reloads controls without erasing reason or automatically retrying", async () => {
  const f = fixture();
  await f.open("Enviar para outro editor");
  f.edit("Preciso de outro editor");
  f.responses.push({ ok: false, status: 409 });
  await f.submit();
  assert.deepEqual(f.counts(), { refreshes: 1, reloads: 2 });
  assert.equal(f.calls.length, 1);
  assert.equal(f.nodes(f.render(), "textarea")[0].props.value, "Preciso de outro editor");
  f.state.controls.version = 5;
  await f.submit();
  assert.equal(JSON.parse(f.calls[1].body).version, 5);
  assert.notEqual(f.calls[0].headers["idempotency-key"], f.calls[1].headers["idempotency-key"]);
});

test("reason boundaries and server controls gate requests", async () => {
  const f = fixture();
  await f.open();
  for (const reason of ["    ", "abcd", "a".repeat(501)]) {
    f.edit(reason);
    await f.submit();
  }
  f.edit("Motivo válido");
  for (const controls of [
    { canCancel: false, cancelled: false },
    { canCancel: true, cancelled: true },
  ]) {
    Object.assign(f.state.controls, controls);
    await f.submit();
  }
  assert.equal(f.calls.length, 0);
  Object.assign(f.state.controls, { cancelled: false, canCancel: true });
  f.state.error = "controls unavailable";
  await f.submit();
  assert.equal(f.calls.length, 0);
});

test("editing reason after a failed request creates a new idempotency key", async () => {
  const f = fixture();
  await f.open();
  f.edit("Primeiro motivo");
  f.responses.push({ ok: false, status: 500, json: async () => ({ error: "Falha temporária" }) });
  await f.submit();
  f.edit("Outro motivo");
  await f.submit();
  assert.notEqual(f.calls[0].headers["idempotency-key"], f.calls[1].headers["idempotency-key"]);
});
