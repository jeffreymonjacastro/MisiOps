import { test } from "node:test";
import assert from "node:assert/strict";

import { hasErrors, validateDraft } from "./transactions.ts";
import { sampleLedger } from "./sample-data.ts";
import { draftFrom } from "./transactions.ts";

test("every sample transaction is valid against the sample's own categories", () => {
  const ledger = sampleLedger();
  for (const transaction of ledger.transactions) {
    const errors = validateDraft(ledger, draftFrom(transaction));
    assert.equal(hasErrors(errors), false, `${transaction.id}: ${JSON.stringify(errors)}`);
  }
});

test("includes both an over-budget and an under-budget category", () => {
  const ledger = sampleLedger();
  const spentBy = (categoryId: string) =>
    ledger.transactions
      .filter((t) => t.categoryId === categoryId && t.date.startsWith(ledger.transactions[0].date.slice(0, 7)))
      .reduce((sum, t) => sum + t.amount, 0);

  const alquiler = ledger.categories.find((c) => c.id === "cat-alquiler")!;
  const mercado = ledger.categories.find((c) => c.id === "cat-mercado")!;
  assert.ok(alquiler.budget !== null && spentBy("cat-alquiler") > alquiler.budget);
  assert.ok(mercado.budget !== null && spentBy("cat-mercado") < mercado.budget);
});

test("mixes income and expense so the dashboard has both to show", () => {
  const ledger = sampleLedger();
  assert.ok(ledger.transactions.some((t) => t.type === "income"));
  assert.ok(ledger.transactions.some((t) => t.type === "expense"));
});
