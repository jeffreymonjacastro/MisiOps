import { test } from "node:test";
import assert from "node:assert/strict";

import { NO_FILTERS, groupByDay, isFiltered } from "../app/lib/query.ts";
import type { Transaction } from "../app/lib/types.ts";

const tx = (id: number, date: string): Transaction => ({
  id,
  amount: 10,
  type: "expense",
  source: "manual",
  description: null,
  transaction_date: date,
  category: { id: 1, name: "Comida", type: "expense" },
});

test("no filters means nothing is filtered", () => {
  assert.equal(isFiltered(NO_FILTERS), false);
  assert.equal(isFiltered({ ...NO_FILTERS, type: "expense" }), true);
  assert.equal(isFiltered({ ...NO_FILTERS, categoryId: 3 }), true);
});

test("groups by calendar day, keeping the server's order", () => {
  const groups = groupByDay([
    tx(1, "2026-09-18T10:00:00Z"),
    tx(2, "2026-09-18T08:00:00Z"),
    tx(3, "2026-09-17T23:00:00Z"),
  ]);
  assert.deepEqual(groups.map((group) => group.date), ["2026-09-18", "2026-09-17"]);
  assert.equal(groups[0].items.length, 2);
});

test("no transaction is lost or merged when grouping", () => {
  const items = [tx(1, "2026-09-18T10:00:00Z"), tx(2, "2026-09-17T10:00:00Z"), tx(3, "2026-09-17T09:00:00Z")];
  const total = groupByDay(items).reduce((sum, group) => sum + group.items.length, 0);
  assert.equal(total, items.length);
});

test("two transactions with the same instant stay separate rows", () => {
  const groups = groupByDay([tx(1, "2026-09-18T10:00:00Z"), tx(2, "2026-09-18T10:00:00Z")]);
  assert.equal(groups[0].items.length, 2);
});

test("an empty page produces no groups", () => {
  assert.deepEqual(groupByDay([]), []);
});
