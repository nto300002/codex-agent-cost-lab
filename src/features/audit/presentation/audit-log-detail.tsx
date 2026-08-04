"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  auditActionLabels,
  auditLogRequest,
  formatAuditDate,
  type AuditLogView,
} from "./audit-log-api";
import styles from "./audit-log.module.css";

function prettyJson(value: string | null) {
  if (value === null) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export function AuditLogDetail({ id }: { id: string }) {
  const [log, setLog] = useState<AuditLogView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    auditLogRequest<{ data: { log: AuditLogView } }>(
      `/api/admin/audit-logs/${id}`,
    )
      .then(({ data }) => setLog(data.log))
      .catch((requestError: unknown) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "監査ログを取得できませんでした",
        ),
      );
  }, [id]);

  if (error) return <p className={styles.error}>{error}</p>;
  if (log === null) return <p>読み込んでいます…</p>;

  return (
    <section className={styles.detailPanel}>
      <dl className={styles.details}>
        <div>
          <dt>日時</dt>
          <dd>{formatAuditDate(log.createdAt)}</dd>
        </div>
        <div>
          <dt>Actor</dt>
          <dd>
            {log.actor.name} ({log.actorUserId})
          </dd>
        </div>
        <div>
          <dt>Action</dt>
          <dd>{auditActionLabels[log.action]}</dd>
        </div>
        <div>
          <dt>Entity</dt>
          <dd>
            {log.entityType} / {log.entityId ?? "—"}
          </dd>
        </div>
      </dl>
      <div className={styles.jsonGrid}>
        <section>
          <h2>変更前</h2>
          <pre>{prettyJson(log.beforeJson)}</pre>
        </section>
        <section>
          <h2>変更後</h2>
          <pre>{prettyJson(log.afterJson)}</pre>
        </section>
      </div>
      <Link className={styles.backLink} href="/admin/audit-logs">
        監査ログ一覧に戻る
      </Link>
    </section>
  );
}
