"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { auditActions } from "../domain/audit-log";
import {
  auditActionLabels,
  auditLogRequest,
  formatAuditDate,
  type AuditLogView,
} from "./audit-log-api";
import styles from "./audit-log.module.css";

type ListData = {
  logs: AuditLogView[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function AuditLogList() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [data, setData] = useState<ListData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    auditLogRequest<{ data: ListData }>(
      `/api/admin/audit-logs${query ? `?${query}` : ""}`,
    )
      .then((response) => {
        if (active) {
          setData(response.data);
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "監査ログを取得できませんでした",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [query]);

  function pageHref(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(page));
    return `/admin/audit-logs?${next}`;
  }

  return (
    <>
      <section className={styles.toolbar} aria-label="監査ログの絞り込み">
        <form
          action="/admin/audit-logs"
          method="get"
          className={styles.filters}
        >
          <label>
            <span>Actor</span>
            <input
              name="actor"
              defaultValue={searchParams.get("actor") ?? ""}
              placeholder="名前またはID"
            />
          </label>
          <label>
            <span>Action</span>
            <select
              name="action"
              defaultValue={searchParams.get("action") ?? ""}
            >
              <option value="">すべて</option>
              {auditActions.map((action) => (
                <option key={action} value={action}>
                  {auditActionLabels[action]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Entity Type</span>
            <input
              name="entityType"
              defaultValue={searchParams.get("entityType") ?? ""}
              placeholder="Customer / User"
            />
          </label>
          <button type="submit">絞り込む</button>
          <Link href="/admin/audit-logs">クリア</Link>
        </form>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}
      {data === null && error === null ? <p>読み込んでいます…</p> : null}
      {data ? (
        <section className={styles.panel} aria-live="polite">
          <div className={styles.summary}>{data.pagination.total}件</div>
          <div className={styles.scroll}>
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>詳細</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatAuditDate(log.createdAt)}</td>
                    <td>{log.actor.name}</td>
                    <td>
                      <span className={styles.action}>
                        {auditActionLabels[log.action]}
                      </span>
                    </td>
                    <td>
                      {log.entityType}
                      <small>{log.entityId ?? "—"}</small>
                    </td>
                    <td>
                      <Link href={`/admin/audit-logs/${log.id}`}>表示</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.logs.length === 0 ? (
            <p className={styles.empty}>条件に一致するログはありません。</p>
          ) : null}
          <nav className={styles.pagination} aria-label="監査ログ一覧のページ">
            {data.pagination.page > 1 ? (
              <Link href={pageHref(data.pagination.page - 1)}>前へ</Link>
            ) : (
              <span>前へ</span>
            )}
            <strong>
              {data.pagination.page} / {Math.max(data.pagination.totalPages, 1)}
            </strong>
            {data.pagination.page < data.pagination.totalPages ? (
              <Link href={pageHref(data.pagination.page + 1)}>次へ</Link>
            ) : (
              <span>次へ</span>
            )}
          </nav>
        </section>
      ) : null}
    </>
  );
}
