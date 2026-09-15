import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NO_FILTERS,
  filterTransactions,
  groupByDay,
  isFiltered,
  monthKey,
  sortByDateDesc,
} from "./query.ts";
import type { Transaction } from "./types.ts";

const tx = (over: Partial<Transaction> & { id: string }): Transaction => ({
  amount: 10,
  type: "expense",
  categoryId: "cat-mercado",
  date: "2026-09-10",
  description: "",
  ...over,
});

const sample: Transaction[] = [
  tx({ id: "a", date: "2026-09-01", amount: 50 }),
  tx({ id: "b", date: "2026-09-30", amount: 20, categoryId: "cat-transporte" }),
  tx({ id: "c", date: "2026-08-15", amount: 80 }),
  tx({ id: "d", date: "2026-09-15", type: "income", categoryId: "cat-sueldo", amount: 3000 }),
];

const september = new Date(2026, 8, 20);

test("month key handles the year boundary", () => {
  assert.equal(monthKey(0, new Date(2026, 0, 15)), "2026-01");
  assert.equal(monthKey(-1, new Date(2026, 0, 15)), "2025-12");
});

test("no filters keeps everything", () => {
  assert.equal(filterTransactions(sample, NO_FILTERS, september).length, 4);
  assert.equal(isFiltered(NO_FILTERS), false);
});

test("filters by type", () => {
  const found = filterTransactions(sample, { ...NO_FILTERS, type: "income" }, september);
  assert.deepEqual(found.map((t) => t.id), ["d"]);
});

test("filters by category", () => {
  const found = filterTransactions(sample, { ...NO_FILTERS, categoryId: "cat-transporte" }, september);
  assert.deepEqual(found.map((t) => t.id), ["b"]);
});

test("this month includes the first and last day, and excludes other months", () => {
  const found = filterTransactions(sample, { ...NO_FILTERS, period: "this-month" }, september);
  assert.deepEqual(found.map((t) => t.id).sort(), ["a", "b", "d"]);
});

test("last month looks at the previous calendar month only", () => {
  const found = filterTransactions(sample, { ...NO_FILTERS, period: "last-month" }, september);
  assert.deepEqual(found.map((t) => t.id), ["c"]);
});

test("filters combine", () => {
  const found = filterTransactions(
    sample,
    { type: "expense", categoryId: "cat-mercado", period: "this-month" },
    september,
  );
  assert.deepEqual(found.map((t) => t.id), ["a"]);
});

test("sorts newest first", () => {
  assert.deepEqual(sortByDateDesc(sample).map((t) => t.id), ["b", "d", "a", "c"]);
});

test("groups by day without losing or merging transactions", () => {
  const sameDay = [tx({ id: "x", date: "2026-09-10" }), tx({ id: "y", date: "2026-09-10" })];
  const groups = groupByDay([...sample, ...sameDay]);
  assert.equal(groups.reduce((total, group) => total + group.items.length, 0), 6);
  const day = groups.find((g) => g.date === "2026-09-10");
  assert.equal(day?.items.length, 2);
});

test("two transactions with the same date and amount stay as separate rows", () => {
  const twins = [tx({ id: "p", date: "2026-09-05", amount: 12 }), tx({ id: "q", date: "2026-09-05", amount: 12 })];
  assert.equal(groupByDay(twins)[0].items.length, 2);
});
