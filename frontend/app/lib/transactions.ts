import { validateAmount } from "./money.ts";
import type { Category, Transaction, TxType } from "./types.ts";

/** Form state. Amount stays a string until submit so typing stays natural. */
export type TransactionDraft = {
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

/**
 * Convenience validation only: the server is the authority and its rejections
 * are surfaced on the same fields (see checklists/security.md).
 */
export function validateDraft(categories: Category[], draft: TransactionDraft): DraftErrors {
  const errors: DraftErrors = {};

  const amountError = validateAmount(draft.amount);
  if (amountError) errors.amount = amountError;

  const category = categories.find((item) => String(item.id) === draft.categoryId);
  if (!category) errors.categoryId = "Elige una categoría.";
  else if (category.type !== draft.type) {
    errors.categoryId = "Esa categoría no corresponde al tipo de movimiento.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(Date.parse(draft.date))) {
    errors.date = "Elige una fecha válida.";
  }

  return errors;
}

export const hasErrors = (errors: DraftErrors) => Object.keys(errors).length > 0;

/**
 * Turns the picked day into an instant at local midday.
 * Sending `${day}T00:00:00Z` would be a *future* instant for anyone east of
 * UTC picking today, which the server rejects (specs/008 edge case).
 */
export function toInstant(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, 12, 0, 0).toISOString();
}

/** Server dates are ISO date-times; the form edits a plain day. */
export const draftFrom = (transaction: Transaction): TransactionDraft => ({
  amount: String(transaction.amount),
  type: transaction.type,
  categoryId: String(transaction.category.id),
  date: transaction.transaction_date.slice(0, 10),
  description: transaction.description ?? "",
});
