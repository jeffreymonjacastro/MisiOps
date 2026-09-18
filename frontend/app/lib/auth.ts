"use client";

import { useSyncExternalStore } from "react";

import { request, setUnauthorizedHandler } from "./api.ts";
import type { Token, User } from "./types.ts";

const KEY = "misiops.token.v1";

/** Key the pre-backend, browser-local ledger (deleted in this feature) used to write under. */
const LEGACY_LEDGER_KEY = "misiops.ledger.v1";

/**
 * A browser that used the app before this feature may still have real
 * ledger data sitting under the old key — nothing here ever reads or writes
 * it anymore, but it stays readable via devtools until swept. Safe to call
 * every time the app boots, signed in or not (FR-012, SC-006).
 */
export function purgeLegacyLedger(): void {
  try {
    window.localStorage.removeItem(LEGACY_LEDGER_KEY);
  } catch {
    // Storage blocked (private window): nothing to purge either way.
  }
}

/**
 * The token lives outside React so useSyncExternalStore gets a stable snapshot.
 * `undefined` means "not read from storage yet".
 */
let cached: string | null | undefined;
const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (cached === undefined) cached = read();
  return cached;
}

export function setToken(token: string | null): void {
  cached = token;
  try {
    if (token) window.localStorage.setItem(KEY, token);
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked (private window): the session still works for this tab.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server render and hydration both see "signed out"; the real value arrives right after. */
const serverSnapshot = (): string | null => null;

export function useToken(): string | null {
  return useSyncExternalStore(subscribe, getToken, serverSnapshot);
}

export async function login(email: string, password: string): Promise<void> {
  const token = await request<Token>("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });
  setToken(token.access_token);
}

/** Register returns no token (006 Clarification Q2), so we log in right after. */
export async function register(name: string, email: string, password: string): Promise<void> {
  await request<User>("/api/v1/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
  await login(email, password);
}

export function logout(): void {
  setToken(null);
}

/** Clears the session once when the server rejects the token, so no retry loop forms. */
export function handleUnauthorized(): void {
  if (getToken() !== null) setToken(null);
}

// Any 401, from any call, ends the session — not just the auth guard's.
setUnauthorizedHandler(handleUnauthorized);
