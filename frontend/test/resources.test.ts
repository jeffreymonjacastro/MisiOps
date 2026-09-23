import { test } from "node:test";
import assert from "node:assert/strict";

import { listQuery, transactionBody } from "../app/lib/resources.ts";

test("'all' filters are dropped instead of being sent to the server", () => {
  const query = listQuery({ type: "all", categoryId: "all", limit: 20, offset: 0 });
  assert.equal(query.type, undefined);
  assert.equal(query.category_id, undefined);
  assert.equal(query.limit, 20);
  assert.equal(query.offset, 0);
});

test("real filters are passed through under the server's parameter names", () => {
  const query = listQuery({ type: "expense", categoryId: 7 });
  assert.equal(query.type, "expense");
  assert.equal(query.category_id, 7);
});

test("a transaction body never carries user_id or source", () => {
  const body = transactionBody({
    amount: 25.5,
    type: "expense",
    category_id: 3,
    description: "Almuerzo",
  });
  assert.equal("user_id" in body, false);
  assert.equal("source" in body, false);
});

test("the amount is sent as a number, not a string", () => {
  const body = transactionBody({ amount: 25.5, type: "expense", category_id: 3 });
  assert.equal(typeof body.amount, "number");
});

test("a blank description is sent as null rather than an empty string", () => {
  assert.equal(
    transactionBody({ amount: 1, type: "expense", category_id: 1, description: "   " }).description,
    null,
  );
  assert.equal(
    transactionBody({ amount: 1, type: "expense", category_id: 1 }).description,
    null,
  );
});

test("a description is trimmed before being sent", () => {
  const body = transactionBody({
    amount: 1,
    type: "expense",
    category_id: 1,
    description: "  Taxi  ",
  });
  assert.equal(body.description, "Taxi");
});

test("transaction_date is omitted when absent so the server can default it", () => {
  assert.equal(
    "transaction_date" in transactionBody({ amount: 1, type: "income", category_id: 2 }),
    false,
  );
  assert.equal(
    transactionBody({
      amount: 1,
      type: "income",
      category_id: 2,
      transaction_date: "2026-09-18T00:00:00Z",
    }).transaction_date,
    "2026-09-18T00:00:00Z",
  );
});
