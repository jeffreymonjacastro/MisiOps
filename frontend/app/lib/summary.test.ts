import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_CATEGORIES } from "./categories.ts";
import { monthTotals, spendingByCategory, sumMoney } from "./summary.ts";
import type { Transaction } from "./types.ts";

const tx = (over: Partial<Transaction> & { id: string }): Transaction => ({
  amount: 10,
  type: "expense",
  categoryId: "cat-mercado",
  date: "2026-09-10",
  description: "",
  ...over,
});

test("sums money without float drift", () => {
  assert.equal(sumMoney([0.1, 0.2]), 0.3);
  assert.equal(sumMoney([19.99, 0.01]), 20);
  assert.equal(sumMoney([]), 0);
});

test("totals income, expenses and the difference for the month", () => {
  const totals = monthTotals(
    [
      tx({ id: "a", type: "income", amount: 3000, categoryId: "cat-sueldo" }),
      tx({ id: "b", amount: 500 }),
      tx({ id: "c", amount: 120.5 }),
    ],
    "2026-09",
  );
  assert.deepEqual(totals, { income: 3000, expenses: 620.5, net: 2379.5 });
});

test("ignores transactions from other months", () => {
  const totals = monthTotals(
    [tx({ id: "a", amount: 100 }), tx({ id: "b", amount: 999, date: "2026-08-31" })],
    "2026-09",
  );
  assert.equal(totals.expenses, 100);
});

test("includes the first and last day of the month", () => {
  const totals = monthTotals(
    [tx({ id: "a", amount: 10, date: "2026-09-01" }), tx({ id: "b", amount: 5, date: "2026-09-30" })],
    "2026-09",
  );
  assert.equal(totals.expenses, 15);
});

test("net goes negative when spending exceeds income", () => {
  const totals = monthTotals(
    [tx({ id: "a", type: "income", amount: 100, categoryId: "cat-sueldo" }), tx({ id: "b", amount: 250 })],
    "2026-09",
  );
  assert.equal(totals.net, -150);
});

test("a month with only expenses still totals correctly", () => {
  assert.deepEqual(monthTotals([tx({ id: "a", amount: 40 })], "2026-09"), {
    income: 0,
    expenses: 40,
    net: -40,
  });
});

test("ranks spending by category, highest first, with shares that add to one", () => {
  const rows = spendingByCategory(
    [
      tx({ id: "a", amount: 100, categoryId: "cat-mercado" }),
      tx({ id: "b", amount: 50, categoryId: "cat-mercado" }),
      tx({ id: "c", amount: 300, categoryId: "cat-alquiler" }),
      tx({ id: "d", amount: 50, categoryId: "cat-transporte" }),
    ],
    DEFAULT_CATEGORIES,
    "2026-09",
  );
  assert.deepEqual(rows.map((r) => r.name), ["Alquiler", "Mercado", "Transporte"]);
  assert.equal(rows[0].total, 300);
  assert.equal(Math.round(rows.reduce((sum, r) => sum + r.share, 0)), 1);
});

test("leaves out income and categories with nothing spent", () => {
  const rows = spendingByCategory(
    [
      tx({ id: "a", amount: 100, categoryId: "cat-mercado" }),
      tx({ id: "b", type: "income", amount: 5000, categoryId: "cat-sueldo" }),
    ],
    DEFAULT_CATEGORIES,
    "2026-09",
  );
  assert.deepEqual(rows.map((r) => r.name), ["Mercado"]);
});

test("a transaction whose category was deleted still appears, labelled", () => {
  const rows = spendingByCategory(
    [tx({ id: "a", amount: 20, categoryId: "cat-borrada" })],
    DEFAULT_CATEGORIES,
    "2026-09",
  );
  assert.equal(rows[0].name, "Sin categoría");
  assert.equal(rows[0].total, 20);
});

test("an empty month produces no rows rather than zero rows", () => {
  assert.deepEqual(spendingByCategory([], DEFAULT_CATEGORIES, "2026-09"), []);
});
