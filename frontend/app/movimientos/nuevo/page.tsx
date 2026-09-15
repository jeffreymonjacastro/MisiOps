"use client";

import { TransactionForm } from "../../components/transaction-form";
import { addTransaction } from "../../lib/transactions";

export default function NewTransactionPage() {
  return (
    <div className="max-w-md space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo movimiento</h1>
        <p className="text-sm text-muted">Anótalo ahora que lo tienes fresco.</p>
      </header>

      <TransactionForm submitLabel="Registrar" onSave={addTransaction} />
    </div>
  );
}
