import { test } from "node:test";
import assert from "node:assert/strict";

import { getToken, handleUnauthorized, logout, setToken } from "./auth.ts";

// auth.ts touches window only inside its functions, so stubbing here — before
// any test runs — is enough.
const store = new Map<string, string>();
let throwOnWrite = false;

(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (throwOnWrite) throw new Error("storage disabled");
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  },
};

test("a token round-trips through storage", () => {
  setToken("abc.def.ghi");
  assert.equal(getToken(), "abc.def.ghi");
  assert.equal(store.get("misiops.token.v1"), "abc.def.ghi");
});

test("logout clears storage, not just memory", () => {
  setToken("abc.def.ghi");
  logout();
  assert.equal(getToken(), null);
  assert.equal(store.has("misiops.token.v1"), false);
});

test("an unauthorized response clears the session", () => {
  setToken("expired");
  handleUnauthorized();
  assert.equal(getToken(), null);
});

test("handling unauthorized twice is harmless and does not re-clear", () => {
  setToken("expired");
  handleUnauthorized();
  handleUnauthorized();
  assert.equal(getToken(), null);
});

test("a blocked storage still keeps the session usable in memory", () => {
  logout();
  throwOnWrite = true;
  setToken("in-memory-only");
  assert.equal(getToken(), "in-memory-only");
  assert.equal(store.has("misiops.token.v1"), false);
  throwOnWrite = false;
  logout();
});
