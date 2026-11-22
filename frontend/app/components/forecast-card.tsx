import { formatMoney } from "../lib/money";
import type { ForecastStatus, MonthEndForecast } from "../lib/types";

const labels: Record<ForecastStatus, string> = {
  expected_surplus: "Superávit esperado",
  expected_deficit: "Déficit esperado",
  tight_close: "Cierre ajustado",
};

const cutoffDate = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  timeZone: "America/Lima",
});
const monthLabel = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function ForecastCard({ forecast }: { forecast: MonthEndForecast | null }) {
  return (
    <section aria-labelledby="forecast-heading" className="space-y-2 border-t border-line pt-5">
      <h2 id="forecast-heading" className="text-sm font-medium">
        Pronóstico al cierre del mes
        {forecast ? ` · ${monthLabel.format(new Date(forecast.period_start))}` : ""}
      </h2>
      {forecast && forecast.status !== "unavailable" ? (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <p className={`figures text-3xl ${forecast.status === "expected_deficit" ? "text-expense" : "text-text"}`}>
              {formatMoney(forecast.projected_net)}
            </p>
            <p className="text-sm">{labels[forecast.status]}</p>
          </div>
          <p className="text-sm text-muted">
            Estimación con tus movimientos registrados al {cutoffDate.format(new Date(forecast.cutoff))}.
            {" "}Error típico observado: {formatMoney(forecast.error_band)}.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">
          {forecast?.reason === "insufficient_history"
            ? "Necesitamos movimientos registrados en al menos dos meses anteriores para estimar tu cierre."
            : "El pronóstico no está disponible en este momento."}
        </p>
      )}
    </section>
  );
}
