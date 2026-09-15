"use client";

import { useState } from "react";

import { byType } from "../lib/categories";
import { useLedger } from "../lib/ledger-store";
import {
  emptyDraft,
  hasErrors,
  validateDraft,
  type DraftErrors,
  type TransactionDraft,
} from "../lib/transactions";
import type { Ledger, TxType } from "../lib/types";

const TYPES: { value: TxType; label: string }[] = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
];

const fieldClass =
  "w-full rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted";

export function TransactionForm({
  initial,
  submitLabel,
  onSave,
}: {
  initial?: TransactionDraft;
  submitLabel: string;
  /** Applies the draft to the ledger. Throws to reject. */
  onSave: (ledger: Ledger, draft: TransactionDraft) => Ledger;
}) {
  const { ledger, commit } = useLedger();
  const isEdit = initial !== undefined;
  const [draft, setDraft] = useState<TransactionDraft>(initial ?? emptyDraft());
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const categories = byType(ledger.categories, draft.type);

  function set<K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) {
    setDraft((current) => {
      // A category belongs to one type, so switching type drops a stale pick.
      if (key === "type") return { ...current, type: value as TxType, categoryId: "" };
      return { ...current, [key]: value };
    });
    setErrors((current) => ({ ...current, [key === "type" ? "categoryId" : key]: undefined }));
    setSaved(null);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateDraft(ledger, draft);
    setErrors(found);
    if (hasErrors(found)) return;

    try {
      commit(onSave(ledger, draft));
      setSaveError(null);
      if (isEdit) {
        setSaved("Cambios guardados.");
      } else {
        setSaved("Movimiento registrado.");
        setDraft(emptyDraft(draft.type));
      }
    } catch (problem) {
      // The draft stays on screen so nothing typed is lost.
      setSaveError((problem as Error).message);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-muted">Tipo</legend>
        <div className="flex gap-2">
          {TYPES.map((option) => {
            const active = draft.type === option.value;
            const activeTone =
              option.value === "income" ? "border-income text-income" : "border-expense text-expense";
            return (
              <label
                key={option.value}
                className={`flex-1 cursor-pointer rounded-[var(--radius-panel)] border px-3 py-2 text-center text-sm ${
                  active ? activeTone : "border-line text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={option.value}
                  checked={active}
                  onChange={() => set("type", option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <label htmlFor="amount" className="block text-sm text-muted">
          Monto
        </label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">S/</span>
          <input
            id="amount"
            inputMode="decimal"
            value={draft.amount}
            onChange={(event) => set("amount", event.target.value)}
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={errors.amount ? "amount-error" : undefined}
            placeholder="0.00"
            className={`${fieldClass} figures text-lg`}
          />
        </div>
        {errors.amount ? (
          <p id="amount-error" role="alert" className="text-sm text-expense">
            {errors.amount}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="category" className="block text-sm text-muted">
          Categoría
        </label>
        <select
          id="category"
          value={draft.categoryId}
          onChange={(event) => set("categoryId", event.target.value)}
          aria-invalid={errors.categoryId ? true : undefined}
          aria-describedby={errors.categoryId ? "category-error" : undefined}
          className={fieldClass}
        >
          <option value="">Elige una categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId ? (
          <p id="category-error" role="alert" className="text-sm text-expense">
            {errors.categoryId}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="date" className="block text-sm text-muted">
          Fecha
        </label>
        <input
          id="date"
          type="date"
          value={draft.date}
          onChange={(event) => set("date", event.target.value)}
          aria-invalid={errors.date ? true : undefined}
          aria-describedby={errors.date ? "date-error" : undefined}
          className={`${fieldClass} figures`}
        />
        {errors.date ? (
          <p id="date-error" role="alert" className="text-sm text-expense">
            {errors.date}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="description" className="block text-sm text-muted">
          Detalle <span className="text-muted">(opcional)</span>
        </label>
        <input
          id="description"
          value={draft.description}
          onChange={(event) => set("description", event.target.value)}
          placeholder="Dónde fue, a quién, para qué"
          className={fieldClass}
        />
      </div>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          className="rounded-[var(--radius-panel)] bg-amber px-4 py-2 text-sm font-medium text-ink hover:opacity-90"
        >
          {submitLabel}
        </button>
        {saved ? (
          <p role="status" className="text-sm text-income">
            {saved}
          </p>
        ) : null}
      </div>

      {saveError ? (
        <p role="alert" className="text-sm text-expense">
          {saveError} Vuelve a intentarlo; no perdiste lo que escribiste.
        </p>
      ) : null}
    </form>
  );
}
