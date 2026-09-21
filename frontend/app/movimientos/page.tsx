"use client";

import Link from "next/link";
import { useState } from "react";

import { ErrorState, FormError, Loading } from "../components/async-state";
import { AuthGuard } from "../components/auth-guard";
import { isApiError } from "../lib/api";
import { useToken } from "../lib/auth";
import { formatMoney } from "../lib/money";
import { NO_FILTERS, formatDay, groupByDay, isFiltered, type Filters } from "../lib/query";
import { deleteTransaction, listCategories, listTransactions } from "../lib/resources";
import { useAsync } from "../lib/use-async";
import type { Category, Transaction } from "../lib/types";

const PAGE_SIZE = 20;

const controlClass =
  "rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-1.5 text-sm";

export default function TransactionsPage() {
  return (
    <AuthGuard>
      <TransactionsScreen />
    </AuthGuard>
  );
}

function TransactionsScreen() {
  const token = useToken();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [pages, setPages] = useState(1);

  const categories = useAsync(async () => (token ? listCategories(token) : []), [token]);

  /**
   * Filtering and paging are server-side. Pages are fetched by `offset` and
   * concatenated: growing `limit` instead would hit the server's 100-row cap
   * and make older history unreachable.
   */
  const page = useAsync(async () => {
    if (!token) return null;
    const requests = Array.from({ length: pages }, (_, index) =>
      listTransactions(token, {
        type: filters.type,
        categoryId: filters.categoryId,
        limit: PAGE_SIZE,
        offset: index * PAGE_SIZE,
      }),
    );
    const results = await Promise.all(requests);
    const last = results[results.length - 1];
    return { ...last, items: results.flatMap((result) => result.items), offset: 0 };
  }, [token, filters.type, filters.categoryId, pages]);

  function change(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPages(1);
  }

  const groups = page.data ? groupByDay(page.data.items) : [];
  const hasMore = page.data ? page.data.items.length < page.data.total : false;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Movimientos</h1>
        <Link
          href="/movimientos/nuevo"
          className="rounded-[var(--radius-panel)] bg-amber px-3 py-2 text-sm font-medium text-ink hover:opacity-90"
        >
          Nuevo movimiento
        </Link>
      </header>

      <FilterBar
        filters={filters}
        categories={categories.data ?? []}
        onChange={change}
        onClear={() => change(NO_FILTERS)}
      />

      {page.loading ? <Loading label="Cargando tus movimientos…" /> : null}
      {page.error ? <ErrorState error={page.error} onRetry={page.reload} /> : null}

      {page.data && page.data.total === 0 ? (
        isFiltered(filters) ? (
          <p className="border-y border-line py-8 text-sm text-muted">
            Ningún movimiento coincide con estos filtros. Prueba ampliarlos o límpialos.
          </p>
        ) : (
          <div className="max-w-prose space-y-4 border-y border-line py-10">
            <p className="text-sm text-muted">
              Todavía no registras nada. Apunta tu primer gasto o ingreso y aquí verás el
              historial completo.
            </p>
            <Link
              href="/movimientos/nuevo"
              className="inline-block rounded-[var(--radius-panel)] border border-amber px-4 py-2 text-sm font-medium text-amber hover:bg-amber hover:text-ink"
            >
              Registrar el primero
            </Link>
          </div>
        )
      ) : null}

      {page.data && page.data.total > 0 ? (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.date} className="space-y-1">
              <h2 className="text-sm text-muted first-letter:uppercase">
                {formatDay(group.date)}
              </h2>
              <ul className="divide-y divide-line border-y border-line">
                {group.items.map((transaction) => (
                  <TransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    onChanged={page.reload}
                  />
                ))}
              </ul>
            </section>
          ))}

          {hasMore ? (
            <button
              type="button"
              onClick={() => setPages((value) => value + 1)}
              className="rounded-[var(--radius-panel)] border border-line px-4 py-2 text-sm text-muted hover:text-text"
            >
              Ver más ({page.data.total - page.data.items.length} restantes)
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FilterBar({
  filters,
  categories,
  onChange,
  onClear,
}: {
  filters: Filters;
  categories: Category[];
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="filter-type">
        Tipo
      </label>
      <select
        id="filter-type"
        value={filters.type}
        onChange={(event) => onChange({ type: event.target.value as Filters["type"] })}
        className={controlClass}
      >
        <option value="all">Todo tipo</option>
        <option value="expense">Solo gastos</option>
        <option value="income">Solo ingresos</option>
      </select>

      <label className="sr-only" htmlFor="filter-category">
        Categoría
      </label>
      <select
        id="filter-category"
        value={String(filters.categoryId)}
        onChange={(event) =>
          onChange({
            categoryId: event.target.value === "all" ? "all" : Number(event.target.value),
          })
        }
        className={controlClass}
      >
        <option value="all">Todas las categorías</option>
        {(["expense", "income"] as const).map((type) => (
          <optgroup key={type} label={type === "expense" ? "Gastos" : "Ingresos"}>
            {categories
              .filter((category) => category.type === type)
              .map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>

      {isFiltered(filters) ? (
        <button type="button" onClick={onClear} className="px-2 py-1.5 text-sm text-amber">
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}

function TransactionRow({
  transaction,
  onChanged,
}: {
  transaction: Transaction;
  onChanged: () => void;
}) {
  const token = useToken();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const income = transaction.type === "income";

  async function remove() {
    if (!token) return;
    try {
      await deleteTransaction(token, transaction.id);
      setConfirming(false);
      setError(null);
      onChanged();
    } catch (problem) {
      setError(isApiError(problem) ? problem.message : "No se pudo eliminar.");
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <li className="space-y-2 py-3">
        <p className="text-sm">
          ¿Eliminar este movimiento de {formatMoney(transaction.amount)}? No se puede deshacer.
        </p>
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
    <li className="group space-y-1 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{transaction.description || transaction.category.name}</p>
          <p className="text-xs text-muted">
            {transaction.category.name}
            <span className="sr-only">{income ? " · ingreso" : " · gasto"}</span>
          </p>
        </div>

        <span className="flex shrink-0 gap-3 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <Link
            href={`/movimientos/${transaction.id}`}
            className="text-sm text-muted hover:text-text"
          >
            Editar
          </Link>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-muted hover:text-expense"
          >
            Eliminar
          </button>
        </span>

        <p className={`figures shrink-0 text-sm ${income ? "text-income" : "text-text"}`}>
          {income ? "+" : "−"}
          {formatMoney(transaction.amount)}
        </p>
      </div>
      <FormError message={error} />
    </li>
  );
}
