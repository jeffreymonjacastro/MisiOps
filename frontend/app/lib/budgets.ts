import { parseAmount, validateAmount } from "./money.ts";
import { sumMoney } from "./summary.ts";
import type { Ledger } from "./types";

export type BudgetProgress = {
  categoryId: string;
  name: string;
  limit: number;
  spent: number;
  over: boolean;
  /** Spent over limit, capped at 1 for bar width. */
  share: number;
};

/** Pass null to drop the limit. Income categories cannot carry one. */
export function setBudget(ledger: Ledger, categoryId: string, input: string | null): Ledger {
  const category = ledger.categories.find((c) => c.id === categoryId);
  if (!category) throw new Error("Esa categoría ya no existe.");
  if (category.type !== "expense") throw new Error("Solo los gastos pueden tener presupuesto.");

  let budget: number | null = null;
  if (input !== null && input.trim() !== "") {
    const error = validateAmount(input);
    if (error) throw new Error(error);
    budget = parseAmount(input);
  }

  return {
    ...ledger,
    categories: ledger.categories.map((c) => (c.id === categoryId ? { ...c, budget } : c)),
  };
}

/** Only categories that carry a limit. Highest overspend first. */
export function budgetProgress(ledger: Ledger, month: string): BudgetProgress[] {
  return ledger.categories
    .filter((category) => category.type === "expense" && category.budget !== null)
    .map((category) => {
      const limit = category.budget as number;
      const spent = sumMoney(
        ledger.transactions
          .filter(
            (t) =>
              t.type === "expense" &&
              t.categoryId === category.id &&
              t.date.startsWith(month),
          )
          .map((t) => t.amount),
      );
      return {
        categoryId: category.id,
        name: category.name,
        limit,
        spent,
        over: spent > limit,
        share: limit > 0 ? Math.min(spent / limit, 1) : 0,
      };
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit || a.name.localeCompare(b.name, "es"));
}
