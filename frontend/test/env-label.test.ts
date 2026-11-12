import assert from "node:assert/strict";
import { test } from "node:test";
import { envLabel } from "../app/lib/env";

test("APP_ENV=dev shows the non-production label", () => {
  assert.deepEqual(envLabel("dev"), { visible: true, name: "dev" });
});

test("APP_ENV=prod shows no label", () => {
  assert.deepEqual(envLabel("prod"), { visible: false });
});

test("missing APP_ENV (local Docker, tests) shows no label", () => {
  assert.deepEqual(envLabel(undefined), { visible: false });
  assert.deepEqual(envLabel(""), { visible: false });
});
