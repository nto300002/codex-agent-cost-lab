import type { CustomerOwner, CustomerStatus } from "../domain/customer";

export type CustomerView = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: CustomerStatus;
  ownerId: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  owner?: CustomerOwner;
  tags?: CustomerOwner[];
};

type ErrorBody = {
  error?: {
    message?: string;
    details?: Record<string, string[]>;
  };
};

export class CustomerApiError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

export async function customerRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new CustomerApiError(
      body.error?.message ?? "処理を完了できませんでした",
      body.error?.details,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function formatCustomerDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export const customerStatusLabels: Record<CustomerStatus, string> = {
  LEAD: "見込み",
  ACTIVE: "取引中",
  INACTIVE: "休眠",
};
