export type TxType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: TxType;
  /** Monthly spending limit. Expense categories only; null when unset. */
  budget: number | null;
};

export type Transaction = {
  id: string;
  amount: number;
  type: TxType;
  categoryId: string;
  /** ISO date, day precision: YYYY-MM-DD */
  date: string;
  description: string;
};

export type Ledger = {
  categories: Category[];
  transactions: Transaction[];
};
