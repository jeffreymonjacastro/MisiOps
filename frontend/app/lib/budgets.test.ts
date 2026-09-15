import { test } from "node:test";
import assert from "node:assert/strict";

import { budgetProgress, setBudget } from "./budgets.ts";
import { DEFAULT_CATEGORIES, deleteCategory } from "./categories.ts";
import type { Ledger, Transaction } from "./types.ts";

const tx = (over: Partial<Transaction> & { id: string }): Transaction => ({
  amount: 10,
  type: "expense",
  categoryId: "cat-mercado",
  date: "2026-09-10",
  description: "",
  ...over,
});

const ledger = (): Ledger => ({
  categories: [...DEFAULT_CATEGORIES],
  transactions: [
    tx({ id: "a", amount: 120, categoryId: "cat-mercado" }),
    tx({ id: "b", amount: 60, categoryId: "cat-mercado", date: "2026-08-02" }),
    tx({ id: "c", amount: 400, categoryId: "cat-comida-fuera" }),
  ],
});

test("sets and clears a limit", () => {
  const withLimit = setBudget(ledger(), "cat-mercado", "300");
  assert.equal(withLimit.categories.find((c) => c.id === "cat-mercado")?.budget, 300);

  const cleared = setBudget(withLimit, "cat-mercado", null);
  assert.equal(cleared.categories.find((c) => c.id === "cat-mercado")?.budget, null);
});

test("an empty input clears the limit rather than failing", () => {
  const withLimit = setBudget(ledger(), "cat-mercado", "300");
  assert.equal(setBudget(withLimit, "cat-mercado", "  ").categories.find((c) => c.id === "cat-mercado")?.budget, null);
});

test("rejects a zero or negative limit", () => {
  assert.throws(() => setBudget(ledger(), "cat-mercado", "0"));
  assert.throws(() => setBudget(ledger(), "cat-mercado", "-40"));
});

test("income categories cannot carry a limit", () => {
  assert.throws(() => setBudget(ledger(), "cat-sueldo", "1000"));
});

test("only budgeted categories appear in the progress list", () => {
  const withLimit = setBudget(ledger(), "cat-mercado", "300");
  const rows = budgetProgress(withLimit, "2026-09");
  assert.deepEqual(rows.map((r) => r.name), ["Mercado"]);
});

test("counts only this month's spending against the limit", () => {
  const rows = budgetProgress(setBudget(ledger(), "cat-mercado", "300"), "2026-09");
  assert.equal(rows[0].spent, 120);
  assert.equal(rows[0].over, false);
});

test("spending past the limit is flagged and the bar stays capped", () => {
  const rows = budgetProgress(setBudget(ledger(), "cat-comida-fuera", "250"), "2026-09");
  assert.equal(rows[0].spent, 400);
  assert.equal(rows[0].over, true);
  assert.equal(rows[0].share, 1);
});

test("progress resets for a month with no spending, keeping the limit", () => {
  const rows = budgetProgress(setBudget(ledger(), "cat-mercado", "300"), "2026-10");
  assert.equal(rows[0].limit, 300);
  assert.equal(rows[0].spent, 0);
  assert.equal(rows[0].over, false);
});

test("lowering the limit mid-month immediately shows the overspend", () => {
  const rows = budgetProgress(setBudget(ledger(), "cat-mercado", "100"), "2026-09");
  assert.equal(rows[0].over, true);
});

test("deleting the category takes its limit with it", () => {
  const withLimit = setBudget(ledger(), "cat-mercado", "300");
  const removed = deleteCategory(withLimit, "cat-mercado");
  assert.deepEqual(budgetProgress(removed, "2026-09"), []);
});

test("the most overspent category is listed first", () => {
  const both = setBudget(setBudget(ledger(), "cat-mercado", "300"), "cat-comida-fuera", "250");
  assert.equal(budgetProgress(both, "2026-09")[0].name, "Comida fuera");
});
