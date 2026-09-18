export type ApiError = {
  /** HTTP status, or 0 when the server could not be reached at all. */
  status: number;
  message: string;
  /** Field name -> message, derived from FastAPI's 422 `detail[].loc`. */
  fieldErrors: Record<string, string>;
};

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export const isApiError = (value: unknown): value is ApiError =>
  typeof value === "object" && value !== null && "status" in value && "fieldErrors" in value;

const GENERIC: Record<number, string> = {
  0: "No pudimos conectarnos al servidor. Revisa tu conexión e inténtalo de nuevo.",
  401: "Tu sesión terminó. Vuelve a entrar.",
  403: "No tienes acceso a esto.",
  404: "No encontramos lo que buscabas.",
  409: "Esa operación entra en conflicto con datos que ya existen.",
  422: "Revisa los datos ingresados.",
  500: "El servidor tuvo un problema. Inténtalo de nuevo en un momento.",
};

type ValidationItem = { loc?: unknown[]; msg?: string };

/** FastAPI returns `{detail: string}` or `{detail: [{loc, msg, type}]}`. Both land here. */
export function normalizeError(status: number, body: unknown): ApiError {
  const fallback = GENERIC[status] ?? `Algo salió mal (error ${status}).`;
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return { status, message: detail, fieldErrors: {} };
  }

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as ValidationItem[]) {
      // loc is like ["body", "amount"]; the field is the last string segment.
      const field = [...(item.loc ?? [])].reverse().find((part) => typeof part === "string");
      if (typeof field === "string" && field !== "body" && item.msg && !fieldErrors[field]) {
        fieldErrors[field] = item.msg;
      }
    }
    const first = (detail as ValidationItem[]).find((item) => item.msg)?.msg;
    return { status, message: first ?? fallback, fieldErrors };
  }

  return { status, message: fallback, fieldErrors: {} };
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
  /** Query parameters; entries whose value is undefined or null are dropped. */
  query?: Record<string, string | number | undefined | null>;
};

export function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

/** Rejects with an ApiError, never with a raw fetch error. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, query } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // Never include the token or the URL here; see checklists/security.md.
    throw normalizeError(0, null);
  }

  if (response.status === 204) return undefined as T;

  // Only parse once the status is known; an error page may not be JSON at all.
  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = normalizeError(response.status, payload);
    // A rejected token is a logout wherever it happens, not only in the auth
    // guard: otherwise an expired session shows a generic error forever.
    if (error.status === 401 && onUnauthorized) onUnauthorized();
    throw error;
  }
  return payload as T;
}

let onUnauthorized: (() => void) | null = null;

/** Wired once at startup by the auth module, keeping api.ts free of its imports. */
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}
