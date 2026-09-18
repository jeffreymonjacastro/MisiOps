"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FormError } from "../components/async-state";
import { isApiError } from "../lib/api";
import { login, register, useToken } from "../lib/auth";

type Mode = "login" | "register";

const fieldClass =
  "w-full rounded-[var(--radius-panel)] border border-line bg-surface px-3 py-2 text-sm placeholder:text-muted";

export default function LoginPage() {
  const router = useRouter();
  const token = useToken();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Someone already signed in has no business on this screen.
  useEffect(() => {
    if (token) router.replace("/");
  }, [token, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      if (mode === "login") await login(email, password);
      else await register(name, email, password);
      router.replace("/");
    } catch (problem) {
      if (isApiError(problem)) {
        setFieldErrors(problem.fieldErrors);
        setError(
          problem.status === 401
            ? "El correo o la contraseña no coinciden."
            : problem.message,
        );
      } else {
        setError("Algo salió mal. Inténtalo de nuevo.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-8 py-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "login" ? "Entra a MisiOps" : "Crea tu cuenta"}
        </h1>
        <p className="text-sm text-muted">
          {mode === "login"
            ? "Tus movimientos te esperan donde los dejaste."
            : "Empieza a llevar el control de tu plata."}
        </p>
      </header>

      <form onSubmit={submit} noValidate className="space-y-4">
        {mode === "register" ? (
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm text-muted">
              Nombre
            </label>
            <input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              aria-invalid={fieldErrors.name ? true : undefined}
              className={fieldClass}
            />
            <FormError message={fieldErrors.name ?? null} />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm text-muted">
            Correo
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            aria-invalid={fieldErrors.email ? true : undefined}
            className={fieldClass}
          />
          <FormError message={fieldErrors.email ?? null} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm text-muted">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            aria-invalid={fieldErrors.password ? true : undefined}
            className={fieldClass}
          />
          <FormError message={fieldErrors.password ?? null} />
          {mode === "register" ? (
            <p className="text-xs text-muted">Mínimo 8 caracteres.</p>
          ) : null}
        </div>

        <FormError message={error} />

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-[var(--radius-panel)] bg-amber px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>
      </form>

      <p className="text-sm text-muted">
        {mode === "login" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
            setFieldErrors({});
          }}
          className="text-amber underline underline-offset-4"
        >
          {mode === "login" ? "Crea una" : "Entra"}
        </button>
      </p>
    </div>
  );
}
