export type TxType = "income" | "expense";

/** Shapes mirror the backend contracts (specs/006, 007, 008). Ids are server-assigned integers. */

export type Category = {
  id: number;
  name: string;
  type: TxType;
  budget: number | null;
};

export type CategoryRef = {
  id: number;
  name: string;
  type: TxType;
};

export type Transaction = {
  id: number;
  amount: number;
  type: TxType;
  source: "manual" | "telegram" | "gmail";
  description: string | null;
  /** ISO 8601 date-time, UTC. */
  transaction_date: string;
  category: CategoryRef;
};

export type TransactionPage = {
  items: Transaction[];
  total: number;
  limit: number;
  offset: number;
};

export type CategoryTotal = {
  category_id: number;
  name: string;
  type: TxType;
  budget: number | null;
  total: number;
};

export type Summary = {
  period_start: string;
  period_end: string;
  total_income: number;
  total_expense: number;
  balance: number;
  monthly_budget_limit: number;
  /** Null when no monthly limit is set. */
  remaining_budget: number | null;
  by_category: CategoryTotal[];
};

export type Token = {
  access_token: string;
  token_type?: string;
};

export type User = {
  id: number;
  name: string;
  email: string;
  telegram_chat_id: string | null;
  monthly_budget_limit: number;
  budget_start_day: number;
  created_at: string;
};
export type ForecastStatus = "expected_surplus" | "expected_deficit" | "tight_close";

export type MonthEndForecast = {
  period_start: string;
  period_end: string;
  cutoff: string;
  currency: "PEN";
} & (
  | { status: "unavailable"; reason: "insufficient_history" | "model_unavailable";
      projected_net: null; error_band: null; model_version: null }
  | { status: ForecastStatus; reason: null;
      projected_net: number; error_band: number; model_version: string }
);
