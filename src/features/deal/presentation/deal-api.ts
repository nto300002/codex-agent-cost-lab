import type { DealStage } from "../domain/deal";
export type DealView = {
  id: string;
  customerId: string;
  title: string;
  amountCents: number;
  stage: DealStage;
  ownerId: string;
  expectedCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; ownerId: string };
  owner?: { id: string; name: string };
};
type ErrorBody = {
  error?: { message?: string; details?: Record<string, string[]> };
};
export class DealApiError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, string[]> = {},
  ) {
    super(message);
  }
}
export async function dealRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new DealApiError(
      body.error?.message ?? "処理を完了できませんでした",
      body.error?.details,
    );
  }
  return (await response.json()) as T;
}
export const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});
export const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo" }).format(
        new Date(value),
      )
    : "未定";
