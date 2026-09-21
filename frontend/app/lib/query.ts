import type { Transaction, TxType } from "./types";

/** Filtering and paging now happen server-side; these are display helpers only. */

export type Filters = {
  type: TxType | "all";
  categoryId: number | "all";
};

export const NO_FILTERS: Filters = { type: "all", categoryId: "all" };

export const isFiltered = (filters: Filters) =>
  filters.type !== "all" || filters.categoryId !== "all";

export type DayGroup = { date: string; items: Transaction[] };

/** Groups an already-ordered page by calendar day, preserving the server's order. */
export function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const transaction of transactions) {
    const date = transaction.transaction_date.slice(0, 10);
    const last = groups.at(-1);
    if (last && last.date === date) last.items.push(transaction);
    else groups.push({ date, items: [transaction] });
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
