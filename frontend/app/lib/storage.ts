import { DEFAULT_CATEGORIES } from "./categories.ts";
import type { Ledger } from "./types";

const KEY = "misiops.ledger.v1";

export const emptyLedger = (): Ledger => ({
  categories: [...DEFAULT_CATEGORIES],
  transactions: [],
});

export function loadLedger(): Ledger {
  if (typeof window === "undefined") return emptyLedger();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyLedger();
    const parsed = JSON.parse(raw) as Partial<Ledger>;
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.transactions)) {
      return emptyLedger();
    }
    return { categories: parsed.categories, transactions: parsed.transactions };
  } catch {
    return emptyLedger();
  }
}

export function saveLedger(ledger: Ledger): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ledger));
  } catch {
    // Storage can be full or blocked (private windows). The in-memory ledger
    // stays correct for this session; nothing else to do here.
  }
}
