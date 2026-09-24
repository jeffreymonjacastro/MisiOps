"use client";

import type { ApiError } from "../lib/api";

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <p role="status" className="border-y border-line py-8 text-sm text-muted">
      {label}
    </p>
  );
}

/**
 * Always distinguishable from an empty state: a failure must never read as
 * "you have no data" (spec US5).
 */
export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div role="alert" className="space-y-3 border-y border-expense/40 py-6">
      <p className="text-sm text-expense">{error.message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[var(--radius-panel)] border border-line px-3 py-1.5 text-sm text-muted hover:text-text"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-expense">
      {message}
    </p>
  );
}
