"use client";

import { useLedger } from "../lib/ledger-store";
import { sampleLedger } from "../lib/sample-data";

/**
 * Dev/review convenience only: lets a teammate see the app populated without
 * typing data by hand. Not for production — reviewers run `npm run dev`.
 */
export function SampleDataButton() {
  const { commit } = useLedger();

  if (process.env.NODE_ENV === "production") return null;

  return (
    <button
      type="button"
      onClick={() => commit(sampleLedger())}
      className="inline-block rounded-[var(--radius-panel)] border border-line px-4 py-2 text-sm text-muted hover:text-text"
    >
      Cargar datos de ejemplo
    </button>
  );
}
