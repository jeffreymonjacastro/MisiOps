"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { byType } from "../lib/categories";
import { useLedger } from "../lib/ledger-store";
import { formatMoney } from "../lib/money";
import {
  NO_FILTERS,
  filterTransactions,
  formatDay,
  groupByDay,
  isFiltered,
  type Filters,
} from "../lib/query";
import { deleteTransaction } from "../lib/transactions";
import type { Category, Transaction } from "../lib/types";

const PAGE_SIZE = 50;

const controlClass =
  "rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-1.5 text-sm";

export default function TransactionsPage() {
  const { ledger } = useLedger();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const categoriesById = useMemo(
    () => new Map(ledger.categories.map((c) => [c.id, c])),
    [ledger.categories],
  );

  const matches = useMemo(
    () => filterTransactions(ledger.transactions, filters),
    [ledger.transactions, filters],
  );
  const groups = useMemo(() => groupByDay(matches.slice(0, visible)), [matches, visible]);

  function change(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setVisible(PAGE_SIZE);
  }

  const hasNone = ledger.transactions.length === 0;

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

      {hasNone ? (
        <EmptyState />
      ) : (
        <>
          <FilterBar
            filters={filters}
            categories={ledger.categories}
            onChange={change}
            onClear={() => change(NO_FILTERS)}
          />

          {matches.length === 0 ? (
            <p className="border-y border-line py-8 text-sm text-muted">
              Ningún movimiento coincide con estos filtros. Prueba ampliarlos o límpialos.
            </p>
          ) : (
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
                        category={categoriesById.get(transaction.categoryId)}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              {matches.length > visible ? (
                <button
                  type="button"
                  onClick={() => setVisible((count) => count + PAGE_SIZE)}
                  className="rounded-[var(--radius-panel)] border border-line px-4 py-2 text-sm text-muted hover:text-text"
                >
                  Ver más ({matches.length - visible} restantes)
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="max-w-prose space-y-4 border-y border-line py-10">
      <p className="text-sm text-muted">
        Todavía no registras nada. Apunta tu primer gasto o ingreso y aquí verás el historial
        completo.
      </p>
      <Link
        href="/movimientos/nuevo"
        className="inline-block rounded-[var(--radius-panel)] border border-amber px-4 py-2 text-sm font-medium text-amber hover:bg-amber hover:text-ink"
      >
        Registrar el primero
      </Link>
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
        value={filters.categoryId}
        onChange={(event) => onChange({ categoryId: event.target.value })}
        className={controlClass}
      >
        <option value="all">Todas las categorías</option>
        {(["expense", "income"] as const).map((type) => (
          <optgroup key={type} label={type === "expense" ? "Gastos" : "Ingresos"}>
            {byType(categories, type).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <label className="sr-only" htmlFor="filter-period">
        Periodo
      </label>
      <select
        id="filter-period"
        value={filters.period}
        onChange={(event) => onChange({ period: event.target.value as Filters["period"] })}
        className={controlClass}
      >
        <option value="all">Desde siempre</option>
        <option value="this-month">Este mes</option>
        <option value="last-month">Mes pasado</option>
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
  category,
}: {
  transaction: Transaction;
  category: Category | undefined;
}) {
  const { ledger, commit } = useLedger();
  const [confirming, setConfirming] = useState(false);
  const income = transaction.type === "income";

  if (confirming) {
    return (
      <li className="space-y-2 py-3">
        <p className="text-sm">
          ¿Eliminar este movimiento de {formatMoney(transaction.amount)}? No se puede deshacer.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => commit(deleteTransaction(ledger, transaction.id))}
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
    <li className="group flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {transaction.description || category?.name || "Sin categoría"}
        </p>
        <p className="text-xs text-muted">
          {category?.name ?? "Sin categoría"}
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

      <p
        className={`figures shrink-0 text-sm tabular-nums ${income ? "text-income" : "text-text"}`}
      >
        {income ? "+" : "−"}
        {formatMoney(transaction.amount)}
      </p>
    </li>
  );
}
