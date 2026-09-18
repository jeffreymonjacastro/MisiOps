"use client";

import { useCallback, useSyncExternalStore } from "react";

import { emptyLedger, loadLedger, saveLedger } from "./storage";
import type { Ledger } from "./types";

/**
 * The ledger lives outside React so the snapshot keeps a stable identity
 * between renders; useSyncExternalStore requires that.
 */
let snapshot: Ledger | null = null;
const listeners = new Set<() => void>();

/** Rendered on the server and during hydration: seeded, but empty of history. */
const serverSnapshot = emptyLedger();

function getSnapshot(): Ledger {
  snapshot ??= loadLedger();
  return snapshot;
}

function getServerSnapshot(): Ledger {
  return serverSnapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLedger() {
  const ledger = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const commit = useCallback((next: Ledger) => {
    snapshot = next;
    saveLedger(next);
    listeners.forEach((listener) => listener());
  }, []);

  return { ledger, commit };
}
