import { request } from "./api.ts";
import type {
  Category,
  Summary,
  Transaction,
  TransactionPage,
  TxType,
  User,
} from "./types.ts";

export type ListParams = {
  type?: TxType | "all";
  categoryId?: number | "all";
  limit?: number;
  offset?: number;
};

/** "all" means "no filter", so it is dropped rather than sent to the server. */
export function listQuery(params: ListParams) {
  return {
    type: params.type && params.type !== "all" ? params.type : undefined,
    category_id:
      params.categoryId !== undefined && params.categoryId !== "all"
        ? params.categoryId
        : undefined,
    limit: params.limit,
    offset: params.offset,
  };
}

export type TransactionPayload = {
  amount: number;
  type: TxType;
  category_id: number;
  description?: string | null;
  transaction_date?: string | null;
};

/** The client never sends `user_id` (identity is the token) nor `source` (server sets `manual`). */
export const transactionBody = (payload: TransactionPayload) => ({
  amount: payload.amount,
  type: payload.type,
  category_id: payload.category_id,
  description: payload.description?.trim() ? payload.description.trim() : null,
  ...(payload.transaction_date ? { transaction_date: payload.transaction_date } : {}),
});

export const getMe = (token: string) => request<User>("/api/v1/user/", { token });

export const listCategories = (token: string) =>
  request<Category[]>("/api/v1/category/", { token });

export const createCategory = (
  token: string,
  body: { name: string; type: TxType; budget?: number | null },
) => request<Category>("/api/v1/category/", { method: "POST", token, body });

export const updateCategory = (
  token: string,
  id: number,
  body: { name?: string; type?: TxType; budget?: number | null },
) => request<Category>(`/api/v1/category/${id}`, { method: "PATCH", token, body });

export const deleteCategory = (token: string, id: number) =>
  request<void>(`/api/v1/category/${id}`, { method: "DELETE", token });

export const listTransactions = (token: string, params: ListParams = {}) =>
  request<TransactionPage>("/api/v1/transactions", { token, query: listQuery(params) });

export const createTransaction = (token: string, payload: TransactionPayload) =>
  request<Transaction>("/api/v1/transactions", {
    method: "POST",
    token,
    body: transactionBody(payload),
  });

export const updateTransaction = (token: string, id: number, payload: TransactionPayload) =>
  request<Transaction>(`/api/v1/transactions/${id}`, {
    method: "PATCH",
    token,
    body: transactionBody(payload),
  });

export const deleteTransaction = (token: string, id: number) =>
  request<void>(`/api/v1/transactions/${id}`, { method: "DELETE", token });

export const getSummary = (token: string, range?: { from: string; to: string }) =>
  request<Summary>("/api/v1/transactions/summary", {
    token,
    query: range ? { from: range.from, to: range.to } : undefined,
  });
