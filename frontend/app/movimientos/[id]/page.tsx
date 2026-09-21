"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

import { ErrorState, Loading } from "../../components/async-state";
import { AuthGuard } from "../../components/auth-guard";
import { TransactionForm } from "../../components/transaction-form";
import { useToken } from "../../lib/auth";
import {
  listCategories,
  listTransactions,
  updateTransaction,
  type TransactionPayload,
} from "../../lib/resources";
import { draftFrom } from "../../lib/transactions";
import { useAsync } from "../../lib/use-async";

export default function EditTransactionPage({ params }: PageProps<"/movimientos/[id]">) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <EditTransactionScreen id={Number(id)} />
    </AuthGuard>
  );
}

function EditTransactionScreen({ id }: { id: number }) {
  const token = useToken();
  const router = useRouter();

  /**
   * The API has no GET-by-id, so the row is found by walking the user's own
   * pages. Scanning only the first page would make an older movement
   * uneditable once the history grows past it.
   */
  const { data, error, loading, reload } = useAsync(async () => {
    if (!token) return null;
    const categories = await listCategories(token);
    const PAGE = 100;
    for (let offset = 0; ; offset += PAGE) {
      const page = await listTransactions(token, { limit: PAGE, offset });
      const found = page.items.find((item) => item.id === id);
      if (found) return { transaction: found, categories };
      if (offset + page.items.length >= page.total || page.items.length === 0) break;
    }
    return { transaction: null, categories };
  }, [token, id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  if (!data?.transaction) {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Movimiento no encontrado</h1>
        <p className="text-sm text-muted">
          Puede que lo hayas eliminado, o que ya no esté entre tus movimientos recientes.
        </p>
        <Link href="/movimientos" className="text-sm text-amber underline underline-offset-4">
          Volver a movimientos
        </Link>
      </div>
    );
  }

  const { transaction, categories } = data;

  return (
    <div className="max-w-md space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Editar movimiento</h1>
        <p className="text-sm text-muted">Corrige lo que haga falta y guarda.</p>
      </header>

      <TransactionForm
        categories={categories}
        initial={draftFrom(transaction)}
        submitLabel="Guardar cambios"
        onSubmit={async (payload: TransactionPayload) => {
          if (!token) return;
          await updateTransaction(token, transaction.id, payload);
          router.push("/movimientos");
        }}
      />
    </div>
  );
}
