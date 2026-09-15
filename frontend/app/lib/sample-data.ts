import { DEFAULT_CATEGORIES } from "./categories.ts";
import { monthKey } from "./query.ts";
import type { Ledger, Transaction, TxType } from "./types";

const tx = (
  id: string,
  amount: number,
  type: TxType,
  categoryId: string,
  date: string,
  description: string,
): Transaction => ({ id: `sample-${id}`, amount, type, categoryId, date, description });

/**
 * A believable month of activity, dated relative to today so it never looks
 * stale. Two categories carry a budget so the dashboard's budget-progress
 * section (one over, one under) has something to show too.
 */
export function sampleLedger(): Ledger {
  const thisMonth = monthKey(0);
  const lastMonth = monthKey(-1);

  return {
    categories: DEFAULT_CATEGORIES.map((category) => {
      if (category.id === "cat-alquiler") return { ...category, budget: 800 };
      if (category.id === "cat-mercado") return { ...category, budget: 300 };
      return category;
    }),
    transactions: [
      tx("1", 3200, "income", "cat-sueldo", `${thisMonth}-01`, "Sueldo de la quincena"),
      tx("2", 890, "expense", "cat-alquiler", `${thisMonth}-02`, "Alquiler del depa"),
      tx("3", 45.9, "expense", "cat-mercado", `${thisMonth}-03`, "Verduras y frutas"),
      tx("4", 12, "expense", "cat-transporte", `${thisMonth}-03`, "Taxi a la oficina"),
      tx("5", 120, "expense", "cat-comida-fuera", `${thisMonth}-07`, "Almuerzo con Pau"),
      tx("6", 78.5, "expense", "cat-mercado", `${thisMonth}-11`, "Compra de la semana"),
      tx("7", 250, "income", "cat-extras", `${lastMonth}-11`, "Freelance de diseño"),
      tx("8", 60, "expense", "cat-salud", `${lastMonth}-20`, "Farmacia"),
    ],
  };
}
