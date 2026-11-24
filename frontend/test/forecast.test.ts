import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ForecastCard } from "../app/components/forecast-card.tsx";
import type { MonthEndForecast } from "../app/lib/types.ts";

const base = {
  currency: "PEN",
  cutoff: "2026-11-22T13:00:00Z",
  period_start: "2026-11-01",
  period_end: "2026-11-30",
} as const;

test("renders forecast states, amounts and account eligibility separately", () => {
  for (const [status, label] of [
    ["expected_surplus", "Superávit esperado"],
    ["expected_deficit", "Déficit esperado"],
    ["tight_close", "Cierre ajustado"],
  ] as const) {
    const forecast: MonthEndForecast = {
      ...base, status, projected_net: status === "expected_deficit" ? -100 : 2, reason: null,
      error_band: 30, model_version: "fixture",
    };
    const html = renderToStaticMarkup(createElement(ForecastCard, { forecast }));
    assert.ok(html.includes(label));
    assert.ok(html.includes("Error típico observado"));
  }
  const forecast: MonthEndForecast = {
    ...base, status: "unavailable", reason: "insufficient_history", projected_net: null,
    error_band: null, model_version: null,
  };
  assert.ok(renderToStaticMarkup(createElement(ForecastCard, { forecast })).includes("dos meses"));
  assert.ok(renderToStaticMarkup(createElement(ForecastCard, { forecast: null })).includes("no está disponible"));
});
