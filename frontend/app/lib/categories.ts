import type { Category, Ledger, TxType } from "./types";

/**
 * Reserved ids. These categories always exist so transaction entry is never
 * blocked, and they absorb transactions whose category gets deleted.
 */
export const FALLBACK_ID: Record<TxType, string> = {
  expense: "sys-sin-categoria-expense",
  income: "sys-sin-categoria-income",
};

export const isFallback = (id: string) =>
  id === FALLBACK_ID.expense || id === FALLBACK_ID.income;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: FALLBACK_ID.expense, name: "Sin categoría", type: "expense", budget: null },
  { id: "cat-mercado", name: "Mercado", type: "expense", budget: null },
  { id: "cat-transporte", name: "Transporte", type: "expense", budget: null },
  { id: "cat-comida-fuera", name: "Comida fuera", type: "expense", budget: null },
  { id: "cat-servicios", name: "Servicios", type: "expense", budget: null },
  { id: "cat-alquiler", name: "Alquiler", type: "expense", budget: null },
  { id: "cat-salud", name: "Salud", type: "expense", budget: null },
  { id: "cat-entretenimiento", name: "Entretenimiento", type: "expense", budget: null },
  { id: FALLBACK_ID.income, name: "Sin categoría", type: "income", budget: null },
  { id: "cat-sueldo", name: "Sueldo", type: "income", budget: null },
  { id: "cat-extras", name: "Ingresos extra", type: "income", budget: null },
];

const normalize = (name: string) => name.trim().toLocaleLowerCase("es");

/** Returns an error message, or null when the name may be used. */
export function validateName(
  name: string,
  categories: Category[],
  type: TxType,
  excludeId?: string,
): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Escribe un nombre para la categoría.";
  if (trimmed.length > 40) return "El nombre no puede pasar de 40 caracteres.";
  const clash = categories.some(
    (c) => c.type === type && c.id !== excludeId && normalize(c.name) === normalize(trimmed),
  );
  if (clash) return `Ya tienes una categoría de ${type === "income" ? "ingreso" : "gasto"} con ese nombre.`;
  return null;
}

export const countUses = (ledger: Ledger, categoryId: string) =>
  ledger.transactions.filter((t) => t.categoryId === categoryId).length;

export function addCategory(ledger: Ledger, name: string, type: TxType): Ledger {
  const error = validateName(name, ledger.categories, type);
  if (error) throw new Error(error);
  const category: Category = {
    id: `cat-${crypto.randomUUID()}`,
    name: name.trim(),
    type,
    budget: null,
  };
  return { ...ledger, categories: [...ledger.categories, category] };
}

export function renameCategory(ledger: Ledger, id: string, name: string): Ledger {
  const target = ledger.categories.find((c) => c.id === id);
  if (!target) throw new Error("Esa categoría ya no existe.");
  if (isFallback(id)) throw new Error("La categoría «Sin categoría» no se puede renombrar.");
  const error = validateName(name, ledger.categories, target.type, id);
  if (error) throw new Error(error);
  return {
    ...ledger,
    categories: ledger.categories.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)),
  };
}

/** Transactions under the removed category move to the fallback of the same type. */
export function deleteCategory(ledger: Ledger, id: string): Ledger {
  const target = ledger.categories.find((c) => c.id === id);
  if (!target) throw new Error("Esa categoría ya no existe.");
  if (isFallback(id)) throw new Error("La categoría «Sin categoría» no se puede eliminar.");
  const fallback = FALLBACK_ID[target.type];
  return {
    categories: ledger.categories.filter((c) => c.id !== id),
    transactions: ledger.transactions.map((t) =>
      t.categoryId === id ? { ...t, categoryId: fallback } : t,
    ),
  };
}

export const byType = (categories: Category[], type: TxType) =>
  categories
    .filter((c) => c.type === type)
    .sort((a, b) => {
      if (isFallback(a.id) !== isFallback(b.id)) return isFallback(a.id) ? 1 : -1;
      return a.name.localeCompare(b.name, "es");
    });
