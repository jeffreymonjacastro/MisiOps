/** Typo guard: nobody logs a personal expense above this. */
export const MAX_AMOUNT = 10_000_000;

const formatter = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatMoney = (value: number) => formatter.format(value);

/** Accepts "12.50", "12,50" and thousand separators. Null when unparseable. */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, "").replace(/,/g, ".");
  if (!cleaned || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

/** Returns an error message, or null when the amount may be saved. */
export function validateAmount(input: string): string | null {
  const value = parseAmount(input);
  if (value === null) return "Escribe un monto válido, por ejemplo 25.50.";
  if (value <= 0) return "El monto tiene que ser mayor que cero.";
  if (value > MAX_AMOUNT) return "Ese monto es demasiado alto. Revisa si te sobra un dígito.";
  return null;
}
