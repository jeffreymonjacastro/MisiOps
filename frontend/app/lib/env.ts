/** Runtime (not build-time) environment label, so one image serves every environment (FR-020, R8). */
export type EnvLabel = { visible: true; name: string } | { visible: false };

export function envLabel(env: string | undefined = process.env.APP_ENV): EnvLabel {
  // Only `dev` is labelled: prod shows nothing, and so do local runs and tests (APP_ENV unset).
  return env === "dev" ? { visible: true, name: env } : { visible: false };
}
