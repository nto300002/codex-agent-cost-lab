import type { ActivityType } from "../domain/activity";

export type ActivityView = {
  id: string;
  customerId: string;
  dealId: string | null;
  type: ActivityType;
  summary: string;
  occurredAt: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string; ownerId: string };
  deal?: { id: string; title: string; customerId: string } | null;
  createdBy?: { id: string; name: string };
};

type ErrorBody = {
  error?: { message?: string; details?: Record<string, string[]> };
};

export class ActivityApiError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

export async function activityRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorBody;
    throw new ActivityApiError(
      body.error?.message ?? "処理を完了できませんでした",
      body.error?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function formatActivityDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

export function toTokyoDateTimeInput(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Tokyo",
  })
    .format(new Date(value))
    .replace(" ", "T");
}

export function tokyoDateTimeToUtc(value: string) {
  return new Date(`${value}:00+09:00`).toISOString();
}
