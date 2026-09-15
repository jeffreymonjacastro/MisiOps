import Link from "next/link";

export default function HomePage() {
  return (
    <div className="max-w-prose space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
      <p className="text-sm text-muted">
        Aquí verás cuánto entra, cuánto sale y a dónde se va tu plata cada mes. Por ahora, empieza
        revisando tus categorías.
      </p>
      <Link
        href="/categorias"
        className="inline-block rounded-[var(--radius-panel)] border border-amber px-4 py-2 text-sm font-medium text-amber hover:bg-amber hover:text-ink"
      >
        Ver categorías
      </Link>
    </div>
  );
}
