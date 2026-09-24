import { test } from "node:test";
import assert from "node:assert/strict";

import { MAX_AMOUNT, parseAmount, validateAmount } from "../app/lib/money.ts";
import {
  draftFrom,
  hasErrors,
  validateDraft,
  type TransactionDraft,
} from "../app/lib/transactions.ts";
import type { Category, Transaction } from "../app/lib/types.ts";

const categories: Category[] = [
  { id: 1, name: "Comida", type: "expense", budget: null },
  { id: 2, name: "Sueldo", type: "income", budget: null },
];

const base = (): TransactionDraft => ({
  amount: "25.50",
  type: "expense",
  categoryId: "1",
  date: "2026-09-18",
  description: "Almuerzo",
});
const draft = (over: Partial<TransactionDraft> = {}): TransactionDraft => ({ ...base(), ...over });

test("parses decimal input written with a comma or a dot", () => {
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("12.50"), 12.5);
});

test("rounds to cents instead of keeping float noise", () => {
  assert.equal(parseAmount("0.1"), 0.1);
  assert.equal(parseAmount("19.999"), 20);
});

test("rejects input that is not a number", () => {
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(""), null);
});

test("rejects amounts that are empty, zero, negative or absurdly large", () => {
  assert.ok(validateAmount(""));
  assert.ok(validateAmount("0"));
  assert.ok(validateAmount("-5"));
  assert.ok(validateAmount(String(MAX_AMOUNT + 1)));
  assert.equal(validateAmount("25.50"), null);
});

test("accepts a complete draft", () => {
  assert.equal(hasErrors(validateDraft(categories, draft())), false);
});

test("requires a category that exists among the user's own", () => {
  assert.ok(validateDraft(categories, draft({ categoryId: "" })).categoryId);
  assert.ok(validateDraft(categories, draft({ categoryId: "999" })).categoryId);
});

test("rejects a category whose type does not match the movement", () => {
  assert.ok(validateDraft(categories, draft({ type: "income", categoryId: "1" })).categoryId);
});

test("rejects a malformed date", () => {
  assert.ok(validateDraft(categories, draft({ date: "18/09/2026" })).date);
});

test("a server transaction round-trips into an editable draft", () => {
  const transaction: Transaction = {
    id: 7,
    amount: 25.5,
    type: "expense",
    source: "manual",
    description: "Almuerzo",
    transaction_date: "2026-09-18T00:00:00Z",
    category: { id: 1, name: "Comida", type: "expense" },
  };
  const back = draftFrom(transaction);
  assert.equal(back.categoryId, "1");
  assert.equal(back.date, "2026-09-18");
  assert.equal(back.amount, "25.5");
  assert.equal(hasErrors(validateDraft(categories, back)), false);
});

test("a transaction with no description becomes an empty field, not the string null", () => {
  const back = draftFrom({
    id: 8,
    amount: 10,
    type: "expense",
    source: "manual",
    description: null,
    transaction_date: "2026-09-18T12:30:00Z",
    category: { id: 1, name: "Comida", type: "expense" },
  });
  assert.equal(back.description, "");
});
