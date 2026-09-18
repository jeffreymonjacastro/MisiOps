"use client";

import { useState } from "react";

import { AuthGuard } from "../components/auth-guard";
import { ErrorState, FormError, Loading } from "../components/async-state";
import { isApiError } from "../lib/api";
import { useToken } from "../lib/auth";
import { formatMoney } from "../lib/money";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "../lib/resources";
import { useAsync } from "../lib/use-async";
import type { Category, TxType } from "../lib/types";

const TYPE_LABEL: Record<TxType, string> = { expense: "Gastos", income: "Ingresos" };

export default function CategoriesPage() {
  return (
    <AuthGuard>
      <CategoriesScreen />
    </AuthGuard>
  );
}

function CategoriesScreen() {
  const token = useToken();
  const { data, error, loading, reload } = useAsync(
    async () => (token ? listCategories(token) : []),
    [token],
  );

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Categorías</h1>
        <p className="max-w-prose text-sm text-muted">
          Con estas clasificas cada movimiento. Se guardan en tu cuenta, así que las ves desde
          cualquier dispositivo.
        </p>
      </header>

      {loading ? <Loading label="Cargando tus categorías…" /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      {data ? (
        <div className="grid gap-8 md:grid-cols-2">
          {(["expense", "income"] as const).map((type) => (
            <CategoryColumn
              key={type}
              type={type}
              categories={data.filter((category) => category.type === type)}
              onChanged={reload}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoryColumn({
  type,
  categories,
  onChanged,
}: {
  type: TxType;
  categories: Category[];
  onChanged: () => void;
}) {
  const token = useToken();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      await createCategory(token, { name: draft.trim(), type });
      setDraft("");
      setError(null);
      onChanged();
    } catch (problem) {
      setError(isApiError(problem) ? (problem.fieldErrors.name ?? problem.message) : "No se pudo crear.");
    }
    setBusy(false);
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
        {categories.length === 0 ? (
          <li className="py-3 text-sm text-muted">Todavía no tienes categorías de este tipo.</li>
        ) : (
          categories.map((category) => (
            <CategoryRow key={category.id} category={category} onChanged={onChanged} />
          ))
        )}
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
            disabled={busy}
            className="rounded-[var(--radius-panel)] border border-amber px-3 py-2 text-sm font-medium text-amber hover:bg-amber hover:text-ink disabled:opacity-60"
          >
            Agregar
          </button>
        </div>
        <FormError message={error} />
      </form>
    </section>
  );
}

function CategoryRow({ category, onChanged }: { category: Category; onChanged: () => void }) {
  const token = useToken();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    try {
      await updateCategory(token, category.id, { name: name.trim() });
      setEditing(false);
      setError(null);
      onChanged();
    } catch (problem) {
      setError(isApiError(problem) ? (problem.fieldErrors.name ?? problem.message) : "No se pudo guardar.");
    }
  }

  async function remove() {
    if (!token) return;
    try {
      await deleteCategory(token, category.id);
      setConfirming(false);
      setError(null);
      onChanged();
    } catch (problem) {
      // A 409 names how many transactions block the delete; show it verbatim.
      setError(isApiError(problem) ? problem.message : "No se pudo eliminar.");
      setConfirming(false);
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
          <FormError message={error} />
        </form>
      </li>
    );
  }

  if (confirming) {
    return (
      <li className="space-y-2 py-2">
        <p className="text-sm">¿Eliminar «{category.name}»?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={remove}
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
    <li className="group space-y-1 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm">
          {category.name}
          {category.budget !== null ? (
            <span className="ml-2 text-xs text-muted">tope {formatMoney(category.budget)}</span>
          ) : null}
        </span>
        <span className="flex shrink-0 gap-3 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
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
      </div>
      <FormError message={error} />
    </li>
  );
}
