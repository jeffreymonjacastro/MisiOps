import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CATEGORIES } from "./categories.ts";
import { MAX_AMOUNT, parseAmount, validateAmount } from "./money.ts";
import {
  addTransaction,
  deleteTransaction,
  draftFrom,
  hasErrors,
  updateTransaction,
  validateDraft,
  type TransactionDraft,
} from "./transactions.ts";
import type { Ledger } from "./types.ts";

const ledger = (): Ledger => ({ categories: [...DEFAULT_CATEGORIES], transactions: [] });

const base = (): TransactionDraft => ({
  amount: "25.50",
  type: "expense",
  categoryId: "cat-mercado",
  date: "2026-09-10",
  description: "Verduras",
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

test("rejects amounts that are empty, zero, negative or absurdly large", () => {
  assert.ok(validateAmount(""));
  assert.ok(validateAmount("0"));
  assert.ok(validateAmount("-5"));
  assert.ok(validateAmount(String(MAX_AMOUNT + 1)));
  assert.equal(validateAmount("25.50"), null);
});

test("accepts a complete draft", () => {
  assert.equal(hasErrors(validateDraft(ledger(), draft())), false);
});

test("requires a category that exists", () => {
  const errors = validateDraft(ledger(), draft({ categoryId: "" }));
  assert.ok(errors.categoryId);
});

test("rejects a category whose type does not match the movement", () => {
  const errors = validateDraft(ledger(), draft({ type: "income", categoryId: "cat-mercado" }));
  assert.ok(errors.categoryId);
});

test("rejects a malformed date", () => {
  assert.ok(validateDraft(ledger(), draft({ date: "10/09/2026" })).date);
});

test("accepts a future date, which is allowed on purpose", () => {
  assert.equal(hasErrors(validateDraft(ledger(), draft({ date: "2099-01-01" }))), false);
});

test("stores the amount as a number and trims the description", () => {
  const next = addTransaction(ledger(), draft({ description: "  Verduras  " }));
  assert.equal(next.transactions[0].amount, 25.5);
  assert.equal(next.transactions[0].description, "Verduras");
});

test("refuses to store an invalid draft", () => {
  assert.throws(() => addTransaction(ledger(), draft({ amount: "0" })));
});

test("editing replaces the values but keeps the same transaction", () => {
  const created = addTransaction(ledger(), draft());
  const id = created.transactions[0].id;
  const edited = updateTransaction(created, id, draft({ amount: "99", description: "Corregido" }));
  assert.equal(edited.transactions.length, 1);
  assert.equal(edited.transactions[0].id, id);
  assert.equal(edited.transactions[0].amount, 99);
});

test("deleting removes only the target transaction", () => {
  const two = addTransaction(addTransaction(ledger(), draft()), draft({ amount: "5" }));
  const next = deleteTransaction(two, two.transactions[0].id);
  assert.equal(next.transactions.length, 1);
  assert.equal(next.transactions[0].amount, 5);
});

test("a stored transaction round-trips back into an editable draft", () => {
  const created = addTransaction(ledger(), draft());
  const back = draftFrom(created.transactions[0]);
  assert.equal(hasErrors(validateDraft(created, back)), false);
  assert.equal(back.categoryId, "cat-mercado");
});
