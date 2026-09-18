"use client";

import Link from "next/link";

import { ErrorState, Loading } from "./components/async-state";
import { AuthGuard } from "./components/auth-guard";
import { useToken } from "./lib/auth";
import { formatMoney } from "./lib/money";
import { getSummary } from "./lib/resources";
import { useAsync } from "./lib/use-async";
import type { CategoryTotal, Summary } from "./lib/types";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardScreen />
    </AuthGuard>
  );
}

function DashboardScreen() {
  const token = useToken();
  const { data, error, loading, reload } = useAsync(
    async () => (token ? getSummary(token) : null),
    [token],
  );

  return (
    <div className="space-y-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
        {data ? (
          <p className="text-sm text-muted">
            Del {formatDate(data.period_start)} al {formatDate(data.period_end)}
          </p>
        ) : null}
      </header>

      {loading ? <Loading label="Calculando tu resumen…" /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      {data ? <SummaryView summary={data} /> : null}
    </div>
  );
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "long" }).format(
    new Date(year, month - 1, day),
  );
}

function SummaryView({ summary }: { summary: Summary }) {
  const nothingLogged = summary.total_income === 0 && summary.total_expense === 0;

  if (nothingLogged) {
    return (
      <div className="max-w-prose space-y-4 border-y border-line py-10">
        <p className="text-sm text-muted">
          Este periodo no tiene movimientos todavía. Registra un ingreso o un gasto y aquí verás
          cuánto te queda.
        </p>
        <Link
          href="/movimientos/nuevo"
          className="inline-block rounded-[var(--radius-panel)] border border-amber px-4 py-2 text-sm font-medium text-amber hover:bg-amber hover:text-ink"
        >
          Registrar un movimiento
        </Link>
      </div>
    );
  }

  const expenses = summary.by_category.filter((row) => row.type === "expense");

  return (
    <>
      <MonthRunway summary={summary} />
      <SpendingBreakdown rows={expenses} total={summary.total_expense} />
    </>
  );
}

/**
 * Income is the track, expenses eat into it, and what remains is the figure.
 * Every number here comes from the server's summary; nothing is recomputed.
 */
function MonthRunway({ summary }: { summary: Summary }) {
  const overrun = summary.balance < 0;
  const spentShare =
    summary.total_income > 0
      ? Math.min(summary.total_expense / summary.total_income, 1)
      : summary.total_expense > 0
        ? 1
        : 0;

  return (
    <section aria-labelledby="runway-heading" className="space-y-4">
      <h2 id="runway-heading" className="sr-only">
        Cómo va el periodo
      </h2>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p
          className={`figures font-[family-name:var(--font-figure)] text-5xl ${
            overrun ? "text-expense" : "text-text"
          }`}
        >
          {formatMoney(Math.abs(summary.balance))}
        </p>
        <p className="text-sm text-muted">
          {overrun ? "gastaste de más este periodo" : "te queda de lo que entró"}
        </p>
      </div>

      <div
        className="h-3 w-full overflow-hidden rounded-full bg-raised"
        role="img"
        aria-label={`Gastaste ${formatMoney(summary.total_expense)} de ${formatMoney(summary.total_income)} que entraron.`}
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
          <dd className="figures text-income">{formatMoney(summary.total_income)}</dd>
        </div>
        <div>
          <dt className="text-muted">Salió</dt>
          <dd className="figures">{formatMoney(summary.total_expense)}</dd>
        </div>
        <div>
          <dt className="text-muted">Tope mensual</dt>
          <dd className="figures">
            {summary.remaining_budget === null ? (
              <span className="text-muted">sin tope</span>
            ) : (
              <>
                {formatMoney(summary.remaining_budget)}{" "}
                <span className="text-muted">de {formatMoney(summary.monthly_budget_limit)}</span>
              </>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function SpendingBreakdown({ rows, total }: { rows: CategoryTotal[]; total: number }) {
  if (rows.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-sm text-muted">En qué se fue</h2>
        <p className="border-y border-line py-6 text-sm text-muted">
          Este periodo solo registraste ingresos.
        </p>
      </section>
    );
  }

  const biggest = Math.max(...rows.map((row) => row.total));

  return (
    <section aria-labelledby="breakdown-heading" className="space-y-3">
      <h2 id="breakdown-heading" className="text-sm text-muted">
        En qué se fue · {formatMoney(total)}
      </h2>
      <ul className="space-y-3">
        {rows.map((row) => {
          const over = row.budget !== null && row.total > row.budget;
          return (
            <li key={row.category_id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{row.name}</span>
                <span className={`figures shrink-0 ${over ? "text-expense" : ""}`}>
                  {formatMoney(row.total)}
                  {row.budget !== null ? (
                    <span className="text-muted"> de {formatMoney(row.budget)}</span>
                  ) : (
                    <span className="ml-2 text-muted">
                      {total > 0 ? Math.round((row.total / total) * 100) : 0}%
                    </span>
                  )}
                  {over ? (
                    <span className="ml-2">{formatMoney(row.total - row.budget!)} de más</span>
                  ) : null}
                </span>
              </div>
              {/* Decorative: every value is already written above in text. */}
              <div aria-hidden className="h-1.5 w-full rounded-full bg-raised">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${biggest > 0 ? (row.total / biggest) * 100 : 0}%`,
                    background: over
                      ? "var(--color-fill-overrun)"
                      : "var(--color-fill-spent)",
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
