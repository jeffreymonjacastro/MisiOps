"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { handleUnauthorized, useToken } from "../lib/auth";
import { getMe } from "../lib/resources";
import { useAsync } from "../lib/use-async";
import { ErrorState, Loading } from "./async-state";

/**
 * Gates every data-bearing screen. A stored token is only trusted once the
 * server confirms it, so a revoked or expired one lands on the login screen
 * instead of rendering half an app.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useToken();

  const { data: user, error, loading, reload } = useAsync(
    async () => (token ? getMe(token) : null),
    [token],
  );

  useEffect(() => {
    if (!token) router.replace("/login");
  }, [token, router]);

  useEffect(() => {
    if (error?.status === 401 || error?.status === 403) {
      handleUnauthorized();
      router.replace("/login");
    }
  }, [error, router]);

  if (!token) return null;
  if (loading) return <Loading label="Verificando tu sesión…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!user) return null;

  return <>{children}</>;
}
