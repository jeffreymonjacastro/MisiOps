"use client";

import { useState } from "react";

import { setBudget } from "../lib/budgets";
import {
  addCategory,
  byType,
  countUses,
  deleteCategory,
  isFallback,
  renameCategory,
} from "../lib/categories";
import { useLedger } from "../lib/ledger-store";
import type { Category, TxType } from "../lib/types";

const TYPE_LABEL: Record<TxType, string> = { expense: "Gastos", income: "Ingresos" };

export default function CategoriesPage() {
  const { ledger } = useLedger();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
        <p className="max-w-prose text-sm text-muted">
          Con estas clasificas cada movimiento. Ya tienes algunas listas para usar; agrega las que
          te falten.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        {(["expense", "income"] as const).map((type) => (
          <CategoryColumn key={type} type={type} categories={byType(ledger.categories, type)} />
        ))}
      </div>
    </div>
  );
}

function CategoryColumn({ type, categories }: { type: TxType; categories: Category[] }) {
  const { ledger, commit } = useLedger();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function create(event: React.FormEvent) {
    event.preventDefault();
    try {
      commit(addCategory(ledger, draft, type));
      setDraft("");
      setError(null);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }

  return (
    <section aria-labelledby={`heading-${type}`} className="space-y-3">
      <h2
        id={`heading-${type}`}
        className="flex items-baseline gap-2 text-sm font-medium text-muted"
      >
        <span className={type === "income" ? "text-income" : "text-expense"} aria-hidden>
          {type === "income" ? "+" : "−"}
        </span>
        {TYPE_LABEL[type]}
      </h2>

      <ul className="divide-y divide-line border-y border-line">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </ul>

      <form onSubmit={create} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            aria-label={`Nueva categoría de ${TYPE_LABEL[type].toLowerCase()}`}
            aria-invalid={error ? true : undefined}
            placeholder="Nombre de la categoría"
            className="min-w-0 flex-1 rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted"
          />
          <button
            type="submit"
            className="rounded-[var(--radius-panel)] border border-amber px-3 py-2 text-sm font-medium text-amber hover:bg-amber hover:text-ink"
          >
            Agregar
          </button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-expense">
            {error}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const { ledger, commit } = useLedger();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const uses = countUses(ledger, category.id);
  const locked = isFallback(category.id);

  function save(event: React.FormEvent) {
    event.preventDefault();
    try {
      commit(renameCategory(ledger, category.id, name));
      setEditing(false);
      setError(null);
    } catch (problem) {
      setError((problem as Error).message);
    }
  }

  if (editing) {
    return (
      <li className="py-2">
        <form onSubmit={save} className="space-y-2">
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label={`Nuevo nombre para ${category.name}`}
              className="min-w-0 flex-1 rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-1.5 text-sm"
            />
            <button type="submit" className="px-2 py-1 text-sm font-medium text-amber">
              Guardar
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setName(category.name);
                setError(null);
              }}
              className="px-2 py-1 text-sm text-muted hover:text-text"
            >
              Cancelar
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-expense">
              {error}
            </p>
          ) : null}
        </form>
      </li>
    );
  }

  if (confirming) {
    return (
      <li className="space-y-2 py-2">
        <p className="text-sm">
          {uses === 0
            ? `¿Eliminar «${category.name}»?`
            : `«${category.name}» tiene ${uses} ${uses === 1 ? "movimiento" : "movimientos"}. Si la eliminas, esos movimientos pasan a «Sin categoría».`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => commit(deleteCategory(ledger, category.id))}
            className="rounded-[var(--radius-panel)] border border-expense px-3 py-1.5 text-sm font-medium text-expense hover:bg-expense hover:text-ink"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="px-3 py-1.5 text-sm text-muted hover:text-text"
          >
            Conservar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-center justify-between gap-3 py-2.5">
      <span className="min-w-0 truncate text-sm">
        {category.name}
        {locked ? <span className="ml-2 text-xs text-muted">fija</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {category.type === "expense" ? <BudgetField category={category} /> : null}
        {locked ? null : (
          <span className="flex gap-3 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm text-muted hover:text-text"
            >
              Renombrar
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-sm text-muted hover:text-expense"
            >
              Eliminar
            </button>
          </span>
        )}
      </span>
    </li>
  );
}

/** Blank clears the limit, so there is no separate "remove" control. */
function BudgetField({ category }: { category: Category }) {
  const { ledger, commit } = useLedger();
  const [value, setValue] = useState(category.budget === null ? "" : String(category.budget));
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (value.trim() === "" && category.budget === null) return;
    try {
      commit(setBudget(ledger, category.id, value.trim() === "" ? null : value));
      setError(null);
    } catch (problem) {
      setError((problem as Error).message);
      setValue(category.budget === null ? "" : String(category.budget));
    }
  }

  return (
    <span className="flex items-center gap-1.5">
      <label htmlFor={`budget-${category.id}`} className="text-xs text-muted">
        Tope S/
      </label>
      <input
        id={`budget-${category.id}`}
        inputMode="decimal"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        placeholder="—"
        aria-invalid={error ? true : undefined}
        title={error ?? undefined}
        className={`figures w-20 rounded-[var(--radius-panel)] border bg-surface px-2 py-1 text-right text-xs ${
          error ? "border-expense" : "border-line"
        }`}
      />
    </span>
  );
}
