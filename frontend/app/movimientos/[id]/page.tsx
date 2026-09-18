"use client";

import Link from "next/link";
import { use } from "react";

import { TransactionForm } from "../../components/transaction-form";
import { useLedger } from "../../lib/ledger-store";
import { draftFrom, updateTransaction } from "../../lib/transactions";
import type { TransactionDraft } from "../../lib/transactions";
import type { Ledger } from "../../lib/types";

export default function EditTransactionPage({ params }: PageProps<"/movimientos/[id]">) {
  const { id } = use(params);
  const { ledger } = useLedger();
  const transaction = ledger.transactions.find((t) => t.id === id);

  if (!transaction) {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Movimiento no encontrado</h1>
        <p className="text-sm text-muted">
          Puede que lo hayas eliminado desde otra pestaña.
        </p>
        <Link href="/movimientos" className="text-sm text-amber underline underline-offset-4">
          Volver a movimientos
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Editar movimiento</h1>
        <p className="text-sm text-muted">Corrige lo que haga falta y guarda.</p>
      </header>

      <TransactionForm
        initial={draftFrom(transaction)}
        submitLabel="Guardar cambios"
        onSave={(current: Ledger, draft: TransactionDraft) =>
          updateTransaction(current, transaction.id, draft)
        }
      />
    </div>
  );
}
