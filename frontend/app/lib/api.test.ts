import { test } from "node:test";
import assert from "node:assert/strict";

import { buildUrl, isApiError, normalizeError } from "./api.ts";

test("a string detail becomes the user-facing message", () => {
  const error = normalizeError(409, { detail: "Category has 3 transactions" });
  assert.equal(error.message, "Category has 3 transactions");
  assert.deepEqual(error.fieldErrors, {});
  assert.equal(error.status, 409);
});

test("a validation array maps each field to its message", () => {
  const error = normalizeError(422, {
    detail: [
      { loc: ["body", "amount"], msg: "Input should be greater than 0", type: "greater_than" },
      { loc: ["body", "category_id"], msg: "Input should be valid", type: "int_parsing" },
    ],
  });
  assert.equal(error.fieldErrors.amount, "Input should be greater than 0");
  assert.equal(error.fieldErrors.category_id, "Input should be valid");
  assert.equal(error.message, "Input should be greater than 0");
});

test("the 'body' wrapper is never treated as a field name", () => {
  const error = normalizeError(422, { detail: [{ loc: ["body"], msg: "Invalid payload" }] });
  assert.deepEqual(error.fieldErrors, {});
  assert.equal(error.message, "Invalid payload");
});

test("the first message wins when a field repeats", () => {
  const error = normalizeError(422, {
    detail: [
      { loc: ["body", "amount"], msg: "first" },
      { loc: ["body", "amount"], msg: "second" },
    ],
  });
  assert.equal(error.fieldErrors.amount, "first");
});

test("a network failure is status 0 with a connection message", () => {
  const error = normalizeError(0, null);
  assert.equal(error.status, 0);
  assert.match(error.message, /conectarnos al servidor/);
});

test("a non-JSON or empty body still yields a usable message", () => {
  assert.match(normalizeError(500, null).message, /servidor/);
  assert.ok(normalizeError(418, {}).message.includes("418"));
});

test("401 says the session ended", () => {
  assert.match(normalizeError(401, null).message, /sesión/);
});

test("isApiError recognises normalized errors and rejects plain ones", () => {
  assert.equal(isApiError(normalizeError(404, null)), true);
  assert.equal(isApiError(new Error("boom")), false);
  assert.equal(isApiError(null), false);
});

test("query parameters that are unset are left out of the URL", () => {
  const url = buildUrl("/api/v1/transactions", {
    type: "expense",
    category_id: undefined,
    limit: 20,
    offset: 0,
  });
  assert.ok(url.includes("type=expense"));
  assert.ok(url.includes("limit=20"));
  assert.ok(url.includes("offset=0"));
  assert.equal(url.includes("category_id"), false);
});

test("a request without query parameters carries no question mark", () => {
  assert.equal(buildUrl("/api/v1/category/").includes("?"), false);
  assert.equal(buildUrl("/api/v1/category/", {}).includes("?"), false);
});
