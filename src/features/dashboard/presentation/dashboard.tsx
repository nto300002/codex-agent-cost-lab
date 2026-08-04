"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { activityTypeLabels } from "../../activity/domain/activity";
import { formatActivityDate } from "../../activity/presentation/activity-api";
import { customerStatuses } from "../../customer/domain/customer";
import { customerStatusLabels } from "../../customer/presentation/customer-api";
import { dealStageLabels, dealStages } from "../../deal/domain/deal";
import { yen } from "../../deal/presentation/deal-api";
import type { DashboardSummary } from "../domain/dashboard";
import styles from "./dashboard.module.css";

type DashboardView = Omit<DashboardSummary, "recentActivities"> & {
  recentActivities: Array<
    Omit<DashboardSummary["recentActivities"][number], "occurredAt"> & {
      occurredAt: string;
    }
  >;
};

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard")
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: { summary: DashboardView };
          error?: { message?: string };
        };
        if (!response.ok || !body.data) {
          throw new Error(body.error?.message ?? "概要を取得できませんでした");
        }
        if (active) setSummary(body.data.summary);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "概要を取得できませんでした",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <p className={styles.error} role="alert">
        {error}
      </p>
    );
  }
  if (!summary) return <p>ダッシュボードを読み込んでいます…</p>;

  return (
    <div className={styles.dashboard}>
      <section className={styles.metrics} aria-label="主要指標">
        <article className={styles.metric} aria-label="担当顧客数">
          <span>担当顧客数</span>
          <strong>{summary.customerCount}</strong>
          <Link href="/customers">顧客一覧</Link>
        </article>
        <article className={styles.metric} aria-label="商談数">
          <span>商談数</span>
          <strong>{summary.dealCount}</strong>
          <Link href="/deals">商談一覧</Link>
        </article>
        <article className={styles.metric} aria-label="進行中商談数">
          <span>進行中商談数</span>
          <strong>{summary.activeDealCount}</strong>
          <small>新規・見込み確認・提案中</small>
        </article>
        <article className={styles.metric} aria-label="今月の受注金額">
          <span>今月の受注金額</span>
          <strong className={styles.amount}>
            {yen.format(summary.wonThisMonthAmountCents)}
          </strong>
          <small>Asia/Tokyo基準</small>
        </article>
      </section>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>顧客ステータス</h2>
          <dl className={styles.breakdown}>
            {customerStatuses.map((status) => (
              <div key={status}>
                <dt>{customerStatusLabels[status]}</dt>
                <dd>{summary.customerStatusCounts[status]}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.panel}>
          <h2>商談ステージ</h2>
          <dl className={styles.breakdown}>
            {dealStages.map((stage) => (
              <div key={stage}>
                <dt>{dealStageLabels[stage]}</dt>
                <dd>{summary.dealStageCounts[stage]}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeading}>
          <h2>直近の活動</h2>
          <span>新しい順に5件</span>
        </div>
        {summary.recentActivities.length === 0 ? (
          <p>活動履歴はありません。</p>
        ) : (
          <ol className={styles.activities}>
            {summary.recentActivities.map((activity) => (
              <li key={activity.id}>
                <div className={styles.activityHeading}>
                  <strong>{activityTypeLabels[activity.type]}</strong>
                  <time dateTime={activity.occurredAt}>
                    {formatActivityDate(activity.occurredAt)}
                  </time>
                </div>
                <p>{activity.summary}</p>
                <div className={styles.activityMeta}>
                  <Link href={`/customers/${activity.customerId}`}>
                    {activity.customer.name}
                  </Link>
                  {activity.deal ? (
                    <Link href={`/deals/${activity.deal.id}`}>
                      {activity.deal.title}
                    </Link>
                  ) : null}
                  <span>記録者: {activity.createdBy.name}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
