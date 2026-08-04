import type { AuditAction } from "../../../../generated/prisma/client";

export type AuditLogView = {
  id: string;
  actorUserId: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
  actor: { id: string; name: string };
};

export const auditActionLabels: Record<AuditAction, string> = {
  CREATE: "作成",
  UPDATE: "更新",
  DELETE: "削除",
  EXPORT: "CSV出力",
  LOGIN: "ログイン",
  LOGOUT: "ログアウト",
  DISABLE: "無効化",
  ROLE_CHANGE: "ロール変更",
};

export async function auditLogRequest<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(body.error?.message ?? "監査ログを取得できませんでした");
  }
  return (await response.json()) as T;
}

export function formatAuditDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}
