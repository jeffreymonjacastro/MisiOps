"use client";

import { useEffect, useState } from "react";

import { isApiError, type ApiError } from "./api.ts";

type State<T> = { key: string; data?: T; error?: ApiError };

/**
 * Loads `load()` whenever `deps` change.
 *
 * `loading` is derived from a key mismatch rather than set in the effect body:
 * the repo's ESLint (react-hooks/set-state-in-effect) forbids a synchronous
 * setState there, and this also removes the stale-data-during-refetch problem.
 */
export function useAsync<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([...deps, nonce]);
  const [state, setState] = useState<State<T>>({ key: "" });

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => {
        if (!cancelled) setState({ key, data });
      },
      (problem: unknown) => {
        if (cancelled) return;
        setState({
          key,
          error: isApiError(problem)
            ? problem
            : { status: 0, message: "Algo salió mal.", fieldErrors: {} },
        });
      },
    );
    return () => {
      cancelled = true;
    };
    // `key` encodes deps and the manual reload counter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: state.key === key ? state.data : undefined,
    error: state.key === key ? state.error : undefined,
    loading: state.key !== key,
    reload: () => setNonce((value) => value + 1),
  };
}
