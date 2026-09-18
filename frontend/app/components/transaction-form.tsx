"use client";

import { useState } from "react";

import { isApiError } from "../lib/api";
import { parseAmount } from "../lib/money";
import type { TransactionPayload } from "../lib/resources";
import {
  emptyDraft,
  hasErrors,
  toInstant,
  validateDraft,
  type DraftErrors,
  type TransactionDraft,
} from "../lib/transactions";
import type { Category, TxType } from "../lib/types";
import { FormError } from "./async-state";

const TYPES: { value: TxType; label: string }[] = [
  { value: "expense", label: "Gasto" },
  { value: "income", label: "Ingreso" },
];

const fieldClass =
  "w-full rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted";

export function TransactionForm({
  categories,
  initial,
  submitLabel,
  onSubmit,
}: {
  categories: Category[];
  initial?: TransactionDraft;
  submitLabel: string;
  /** Sends the payload to the server. Rejects with an ApiError to show its message. */
  onSubmit: (payload: TransactionPayload) => Promise<void>;
}) {
  const isEdit = initial !== undefined;
  const [draft, setDraft] = useState<TransactionDraft>(initial ?? emptyDraft());
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visible = categories.filter((category) => category.type === draft.type);

  function set<K extends keyof TransactionDraft>(key: K, value: TransactionDraft[K]) {
    setDraft((current) => {
      // A category belongs to one type, so switching type drops a stale pick.
      if (key === "type") return { ...current, type: value as TxType, categoryId: "" };
      return { ...current, [key]: value };
    });
    setErrors((current) => ({ ...current, [key === "type" ? "categoryId" : key]: undefined }));
    setSaved(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateDraft(categories, draft);
    setErrors(found);
    if (hasErrors(found)) return;

    setBusy(true);
    try {
      await onSubmit({
        amount: parseAmount(draft.amount) as number,
        type: draft.type,
        category_id: Number(draft.categoryId),
        description: draft.description,
        transaction_date: toInstant(draft.date),
      });
      setSaveError(null);
      if (isEdit) {
        setSaved("Cambios guardados.");
      } else {
        setSaved("Movimiento registrado.");
        setDraft(emptyDraft(draft.type));
      }
    } catch (problem) {
      // The draft stays on screen so nothing typed is lost.
      if (isApiError(problem)) {
        const { fieldErrors, message } = problem;
        setErrors({
          amount: fieldErrors.amount,
          categoryId: fieldErrors.category_id,
          date: fieldErrors.transaction_date,
        });
        setSaveError(message);
      } else {
        setSaveError("No se pudo guardar. Inténtalo de nuevo.");
      }
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-muted">Tipo</legend>
        <div className="flex gap-2">
          {TYPES.map((option) => {
            const active = draft.type === option.value;
            const activeTone =
              option.value === "income"
                ? "border-income text-income"
                : "border-expense text-expense";
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
            placeholder="0.00"
            className={`${fieldClass} figures text-lg`}
          />
        </div>
        <FormError message={errors.amount ?? null} />
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
          className={fieldClass}
        >
          <option value="">Elige una categoría</option>
          {visible.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>
        <FormError message={errors.categoryId ?? null} />
        {visible.length === 0 ? (
          <p className="text-xs text-muted">
            No tienes categorías de este tipo. Crea una en la sección Categorías.
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
          className={`${fieldClass} figures`}
        />
        <FormError message={errors.date ?? null} />
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
          disabled={busy}
          className="rounded-[var(--radius-panel)] bg-amber px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Guardando…" : submitLabel}
        </button>
        {saved ? (
          <p role="status" className="text-sm text-income">
            {saved}
          </p>
        ) : null}
      </div>

      <FormError message={saveError} />
    </form>
  );
}
