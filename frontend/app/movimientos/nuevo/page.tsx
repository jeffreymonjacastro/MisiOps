"use client";

import { ErrorState, Loading } from "../../components/async-state";
import { AuthGuard } from "../../components/auth-guard";
import { TransactionForm } from "../../components/transaction-form";
import { useToken } from "../../lib/auth";
import { createTransaction, listCategories, type TransactionPayload } from "../../lib/resources";
import { useAsync } from "../../lib/use-async";

export default function NewTransactionPage() {
  return (
    <AuthGuard>
      <NewTransactionScreen />
    </AuthGuard>
  );
}

function NewTransactionScreen() {
  const token = useToken();
  const { data: categories, error, loading, reload } = useAsync(
    async () => (token ? listCategories(token) : []),
    [token],
  );

  return (
    <div className="max-w-md space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo movimiento</h1>
        <p className="text-sm text-muted">Anótalo ahora que lo tienes fresco.</p>
      </header>

      {loading ? <Loading /> : null}
      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      {categories ? (
        <TransactionForm
          categories={categories}
          submitLabel="Registrar"
          onSubmit={async (payload: TransactionPayload) => {
            if (!token) return;
            await createTransaction(token, payload);
          }}
        />
      ) : null}
    </div>
  );
}
