import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CATEGORIES,
  FALLBACK_ID,
  addCategory,
  byType,
  deleteCategory,
  renameCategory,
  validateName,
} from "./categories.ts";
import type { Ledger } from "./types.ts";

const ledger = (): Ledger => ({
  categories: [...DEFAULT_CATEGORIES],
  transactions: [
    {
      id: "t1",
      amount: 25,
      type: "expense",
      categoryId: "cat-mercado",
      date: "2026-09-10",
      description: "",
    },
  ],
});

test("seeds both income and expense categories", () => {
  assert.ok(DEFAULT_CATEGORIES.some((c) => c.type === "income"));
  assert.ok(DEFAULT_CATEGORIES.filter((c) => c.type === "expense").length > 1);
});

test("rejects an empty name", () => {
  assert.equal(validateName("   ", [], "expense"), "Escribe un nombre para la categoría.");
});

test("rejects a duplicate name of the same type, ignoring case", () => {
  assert.ok(validateName("mercado", DEFAULT_CATEGORIES, "expense"));
});

test("allows the same name across different types", () => {
  assert.equal(validateName("Mercado", DEFAULT_CATEGORIES, "income"), null);
});

test("allows a category to keep its own name while renaming", () => {
  assert.equal(validateName("Mercado", DEFAULT_CATEGORIES, "expense", "cat-mercado"), null);
});

test("adds a category", () => {
  const next = addCategory(ledger(), "  Mascotas ", "expense");
  assert.ok(next.categories.some((c) => c.name === "Mascotas"));
});

test("renaming keeps transactions pointing at the category", () => {
  const next = renameCategory(ledger(), "cat-mercado", "Supermercado");
  assert.equal(next.categories.find((c) => c.id === "cat-mercado")?.name, "Supermercado");
  assert.equal(next.transactions[0].categoryId, "cat-mercado");
});

test("deleting a category moves its transactions to the fallback, never dropping them", () => {
  const before = ledger();
  const next = deleteCategory(before, "cat-mercado");
  assert.equal(next.categories.some((c) => c.id === "cat-mercado"), false);
  assert.equal(next.transactions.length, before.transactions.length);
  assert.equal(next.transactions[0].categoryId, FALLBACK_ID.expense);
});

test("the fallback category cannot be deleted or renamed", () => {
  assert.throws(() => deleteCategory(ledger(), FALLBACK_ID.expense));
  assert.throws(() => renameCategory(ledger(), FALLBACK_ID.income, "Otra cosa"));
});

test("listing by type sorts alphabetically and puts the fallback last", () => {
  const expenses = byType(DEFAULT_CATEGORIES, "expense");
  assert.equal(expenses.at(-1)?.id, FALLBACK_ID.expense);
  assert.equal(expenses.every((c) => c.type === "expense"), true);
});
