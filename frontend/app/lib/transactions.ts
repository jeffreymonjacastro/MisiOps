import { parseAmount, validateAmount } from "./money.ts";
import type { Ledger, Transaction, TxType } from "./types";

export type TransactionDraft = {
  /** Raw user input, validated on save. */
  amount: string;
  type: TxType;
  categoryId: string;
  date: string;
  description: string;
};

export type DraftErrors = Partial<Record<"amount" | "categoryId" | "date", string>>;

export const today = () => new Date().toLocaleDateString("en-CA");

export const emptyDraft = (type: TxType = "expense"): TransactionDraft => ({
  amount: "",
  type,
  categoryId: "",
  date: today(),
  description: "",
});

export function validateDraft(ledger: Ledger, draft: TransactionDraft): DraftErrors {
  const errors: DraftErrors = {};

  const amountError = validateAmount(draft.amount);
  if (amountError) errors.amount = amountError;

  const category = ledger.categories.find((c) => c.id === draft.categoryId);
  if (!category) {
    errors.categoryId = "Elige una categoría.";
  } else if (category.type !== draft.type) {
    errors.categoryId = "Esa categoría no corresponde al tipo de movimiento.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(Date.parse(draft.date))) {
    errors.date = "Elige una fecha válida.";
  }

  return errors;
}

export const hasErrors = (errors: DraftErrors) => Object.keys(errors).length > 0;

const toTransaction = (draft: TransactionDraft, id: string): Transaction => ({
  id,
  amount: parseAmount(draft.amount) as number,
  type: draft.type,
  categoryId: draft.categoryId,
  date: draft.date,
  description: draft.description.trim(),
});

export function addTransaction(ledger: Ledger, draft: TransactionDraft): Ledger {
  if (hasErrors(validateDraft(ledger, draft))) {
    throw new Error("El movimiento tiene datos inválidos.");
  }
  return {
    ...ledger,
    transactions: [...ledger.transactions, toTransaction(draft, `tx-${crypto.randomUUID()}`)],
  };
}

export function updateTransaction(ledger: Ledger, id: string, draft: TransactionDraft): Ledger {
  if (!ledger.transactions.some((t) => t.id === id)) {
    throw new Error("Ese movimiento ya no existe.");
  }
  if (hasErrors(validateDraft(ledger, draft))) {
    throw new Error("El movimiento tiene datos inválidos.");
  }
  return {
    ...ledger,
    transactions: ledger.transactions.map((t) => (t.id === id ? toTransaction(draft, id) : t)),
  };
}

export function deleteTransaction(ledger: Ledger, id: string): Ledger {
  return {
    ...ledger,
    transactions: ledger.transactions.filter((t) => t.id !== id),
  };
}

export const draftFrom = (transaction: Transaction): TransactionDraft => ({
  amount: String(transaction.amount),
  type: transaction.type,
  categoryId: transaction.categoryId,
  date: transaction.date,
  description: transaction.description,
});
