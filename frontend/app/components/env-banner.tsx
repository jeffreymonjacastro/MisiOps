import { envLabel } from "../lib/env";

/** Fixed non-production banner, rendered only when APP_ENV=dev (FR-020). Server component. */
export function EnvBanner() {
  const label = envLabel();
  if (!label.visible) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full bg-amber-400 px-4 py-1 text-center text-xs font-semibold tracking-wide text-stone-950"
    >
      Entorno de pruebas ({label.name}) · sin datos reales
    </div>
  );
}
