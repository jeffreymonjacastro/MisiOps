"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { SampleDataButton } from "./components/sample-data-button";
import { budgetProgress, type BudgetProgress } from "./lib/budgets";
import { useLedger } from "./lib/ledger-store";
import { formatMoney } from "./lib/money";
import { monthKey } from "./lib/query";
import { monthTotals, spendingByCategory } from "./lib/summary";

const PERIODS = [
  { offset: 0, label: "Este mes" },
  { offset: -1, label: "Mes pasado" },
] as const;

const monthName = (month: string) => {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(
    new Date(year, index - 1, 1),
  );
};

export default function DashboardPage() {
  const { ledger } = useLedger();
  const [offset, setOffset] = useState<0 | -1>(0);
  const month = monthKey(offset);

  const totals = useMemo(() => monthTotals(ledger.transactions, month), [ledger.transactions, month]);
  const spending = useMemo(
    () => spendingByCategory(ledger.transactions, ledger.categories, month),
    [ledger.transactions, ledger.categories, month],
  );
  const budgets = useMemo(() => budgetProgress(ledger, month), [ledger, month]);

  const nothingLogged = totals.income === 0 && totals.expenses === 0;
  // Distinct from nothingLogged: seeding replaces the whole ledger, so it
  // must only be offered when there is truly nothing anywhere to lose —
  // not just nothing in the currently viewed month.
  const noDataAtAll = ledger.transactions.length === 0;

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
          <p className="text-sm text-muted first-letter:uppercase">{monthName(month)}</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Periodo">
          {PERIODS.map((period) => (
            <button
              key={period.offset}
              type="button"
              onClick={() => setOffset(period.offset)}
              aria-pressed={offset === period.offset}
              className={`rounded-[var(--radius-panel)] px-3 py-1.5 text-sm ${
                offset === period.offset ? "bg-raised text-text" : "text-muted hover:text-text"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </header>

      {nothingLogged ? (
        <EmptyMonth showSampleData={noDataAtAll} />
      ) : (
        <>
          <MonthRunway income={totals.income} expenses={totals.expenses} net={totals.net} />
          <BudgetProgressList rows={budgets} />
          <SpendingBreakdown rows={spending} total={totals.expenses} />
        </>
      )}
    </div>
  );
}

function EmptyMonth({ showSampleData }: { showSampleData: boolean }) {
  return (
    <div className="max-w-prose space-y-4 border-y border-line py-10">
      <p className="text-sm text-muted">
        Este mes no tiene movimientos todavía. Registra un ingreso o un gasto y aquí verás cuánto
        te queda.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/movimientos/nuevo"
          className="inline-block rounded-[var(--radius-panel)] border border-amber px-4 py-2 text-sm font-medium text-amber hover:bg-amber hover:text-ink"
        >
          Registrar un movimiento
        </Link>
        {showSampleData ? <SampleDataButton /> : null}
      </div>
    </div>
  );
}

/**
 * The hero: income is the track, expenses eat into it left to right, and what
 * is left is the figure. Answers "how am I doing this month" without reading
 * three separate numbers.
 */
function MonthRunway({
  income,
  expenses,
  net,
}: {
  income: number;
  expenses: number;
  net: number;
}) {
  const overrun = net < 0;
  // With no income logged, any spending is by definition a full overrun.
  const spentShare = income > 0 ? Math.min(expenses / income, 1) : expenses > 0 ? 1 : 0;

  return (
    <section aria-labelledby="runway-heading" className="space-y-4">
      <h2 id="runway-heading" className="sr-only">
        Cómo va el mes
      </h2>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          className={`figures font-[family-name:var(--font-figure)] text-5xl ${
            overrun ? "text-expense" : "text-text"
          }`}
        >
          {formatMoney(Math.abs(net))}
        </p>
        <p className="text-sm text-muted">
          {overrun ? "gastaste de más este mes" : "te queda de lo que entró"}
        </p>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-raised"
        role="img"
        aria-label={`Gastaste ${formatMoney(expenses)} de ${formatMoney(income)} que entraron.`}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${spentShare * 100}%`,
            background: overrun ? "var(--color-fill-overrun)" : "var(--color-fill-spent)",
          }}
        />
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
        <div>
          <dt className="text-muted">Entró</dt>
          <dd className="figures text-income">{formatMoney(income)}</dd>
        </div>
        <div>
          <dt className="text-muted">Salió</dt>
          <dd className="figures">{formatMoney(expenses)}</dd>
        </div>
      </dl>
    </section>
  );
}

function BudgetProgressList({ rows }: { rows: BudgetProgress[] }) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="budgets-heading" className="space-y-3">
      <h2 id="budgets-heading" className="text-sm text-muted">
        Topes del mes
      </h2>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.categoryId} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className={`figures shrink-0 ${row.over ? "text-expense" : ""}`}>
                {formatMoney(row.spent)}
                <span className="text-muted"> de {formatMoney(row.limit)}</span>
                {row.over ? (
                  <span className="ml-2">
                    {formatMoney(row.spent - row.limit)} de más
                  </span>
                ) : null}
              </span>
            </div>
            <div aria-hidden className="h-1.5 w-full rounded-full bg-raised">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.share * 100}%`,
                  background: row.over
                    ? "var(--color-fill-overrun)"
                    : "var(--color-fill-spent)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SpendingBreakdown({
  rows,
  total,
}: {
  rows: { categoryId: string; name: string; total: number; share: number }[];
  total: number;
}) {
  if (rows.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm text-muted">En qué se fue</h2>
        <p className="border-y border-line py-6 text-sm text-muted">
          Este mes solo registraste ingresos.
        </p>
      </section>
    );
  }

  const biggest = rows[0].total;

  return (
    <section aria-labelledby="breakdown-heading" className="space-y-3">
      <h2 id="breakdown-heading" className="text-sm text-muted">
        En qué se fue · {formatMoney(total)}
      </h2>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.categoryId} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="figures shrink-0">
                {formatMoney(row.total)}
                <span className="ml-2 text-muted">{Math.round(row.share * 100)}%</span>
              </span>
            </div>
            {/* Decorative: every value is already written above in text. */}
            <div aria-hidden className="h-1.5 w-full rounded-full bg-raised">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(row.total / biggest) * 100}%`,
                  background: "var(--color-fill-spent)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
