import type { Transaction, TxType } from "./types";

export type Period = "all" | "this-month" | "last-month";

export type Filters = {
  type: TxType | "all";
  categoryId: string | "all";
  period: Period;
};

export const NO_FILTERS: Filters = { type: "all", categoryId: "all", period: "all" };

export const isFiltered = (filters: Filters) =>
  filters.type !== "all" || filters.categoryId !== "all" || filters.period !== "all";

/**
 * "YYYY-MM" for the month `offset` months from `from`. Built from local date
 * parts so a transaction dated the 1st or the 31st lands in its own month
 * regardless of timezone.
 */
export function monthKey(offset = 0, from: Date = new Date()): string {
  const shifted = new Date(from.getFullYear(), from.getMonth() + offset, 1);
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}`;
}

function periodKey(period: Period, now: Date): string | null {
  if (period === "this-month") return monthKey(0, now);
  if (period === "last-month") return monthKey(-1, now);
  return null;
}

export function filterTransactions(
  transactions: Transaction[],
  filters: Filters,
  now: Date = new Date(),
): Transaction[] {
  const month = periodKey(filters.period, now);
  return transactions.filter((t) => {
    if (filters.type !== "all" && t.type !== filters.type) return false;
    if (filters.categoryId !== "all" && t.categoryId !== filters.categoryId) return false;
    if (month && !t.date.startsWith(month)) return false;
    return true;
  });
}

/** Newest first. Ties keep a stable order so equal rows never swap on re-render. */
export const sortByDateDesc = (transactions: Transaction[]): Transaction[] =>
  [...transactions].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : b.date.localeCompare(a.date)));

export type DayGroup = { date: string; items: Transaction[] };

export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const transaction of sortByDateDesc(transactions)) {
    const last = groups.at(-1);
    if (last && last.date === transaction.date) last.items.push(transaction);
    else groups.push({ date: transaction.date, items: [transaction] });
  }
  return groups;
}

const dayFormatter = new Intl.DateTimeFormat("es-PE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Parsed as local time; `new Date("YYYY-MM-DD")` would shift the day in UTC-negative zones. */
export function formatDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return dayFormatter.format(new Date(year, month - 1, day));
}
