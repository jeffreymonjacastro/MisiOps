import type { Category, Transaction } from "./types";

/** Cents, summed as integers: 0.1 + 0.2 must not drift into 0.30000000000000004. */
export const sumMoney = (values: number[]): number =>
  values.reduce((total, value) => total + Math.round(value * 100), 0) / 100;

export type Totals = { income: number; expenses: number; net: number };

export function monthTotals(transactions: Transaction[], month: string): Totals {
  const inMonth = transactions.filter((t) => t.date.startsWith(month));
  const income = sumMoney(inMonth.filter((t) => t.type === "income").map((t) => t.amount));
  const expenses = sumMoney(inMonth.filter((t) => t.type === "expense").map((t) => t.amount));
  return { income, expenses, net: Math.round((income - expenses) * 100) / 100 };
}

export type CategorySpend = {
  categoryId: string;
  name: string;
  total: number;
  /** Fraction of the month's spending, 0-1. Zero when nothing was spent. */
  share: number;
};

/** Highest spend first. Categories with no spending this month are left out. */
export function spendingByCategory(
  transactions: Transaction[],
  categories: Category[],
  month: string,
): CategorySpend[] {
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const totals = new Map<string, number[]>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense" || !transaction.date.startsWith(month)) continue;
    const bucket = totals.get(transaction.categoryId) ?? [];
    bucket.push(transaction.amount);
    totals.set(transaction.categoryId, bucket);
  }

  const spent = sumMoney([...totals.values()].flat());

  return [...totals.entries()]
    .map(([categoryId, amounts]) => {
      const total = sumMoney(amounts);
      return {
        categoryId,
        name: names.get(categoryId) ?? "Sin categoría",
        total,
        share: spent > 0 ? total / spent : 0,
      };
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
}
