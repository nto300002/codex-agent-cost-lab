"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AuthenticatedUser } from "../../auth/domain/auth-user";
import { can } from "../../auth/domain/authorization-policy";
import { ActivityTimeline } from "../../activity/presentation/activity-timeline";
import { dealStageLabels } from "../domain/deal";
import { date, dealRequest, yen, type DealView } from "./deal-api";
import styles from "./deal.module.css";
export function DealDetail({
  user,
  dealId,
}: {
  user: AuthenticatedUser;
  dealId: string;
}) {
  const [deal, setDeal] = useState<DealView | null>(null),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    dealRequest<{ data: { deal: DealView } }>(`/api/deals/${dealId}`)
      .then((r) => {
        if (active) setDeal(r.data.deal);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "取得できませんでした");
      });
    return () => {
      active = false;
    };
  }, [dealId]);
  if (error) return <p className={styles.error}>{error}</p>;
  if (!deal) return <p>商談を読み込んでいます…</p>;
  return (
    <>
      <section className={styles.panel}>
        <h2>{deal.title}</h2>
        <dl className={styles.details}>
          <div>
            <dt>顧客</dt>
            <dd>
              <Link href={`/customers/${deal.customerId}`}>
                {deal.customer?.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt>担当者</dt>
            <dd>{deal.owner?.name}</dd>
          </div>
          <div>
            <dt>金額</dt>
            <dd>{yen.format(deal.amountCents)}</dd>
          </div>
          <div>
            <dt>ステージ</dt>
            <dd>{dealStageLabels[deal.stage]}</dd>
          </div>
          <div>
            <dt>予定完了日</dt>
            <dd>{date(deal.expectedCloseDate)}</dd>
          </div>
          <div>
            <dt>更新日時</dt>
            <dd>{date(deal.updatedAt)}</dd>
          </div>
        </dl>
        <div className={styles.actions}>
          {can(user, "deal:update", { ownerId: deal.ownerId }) ? (
            <Link className={styles.primary} href={`/deals/${deal.id}/edit`}>
              商談を編集
            </Link>
          ) : null}
          <Link className={styles.secondary} href="/deals">
            一覧へ戻る
          </Link>
        </div>
      </section>
      <ActivityTimeline
        user={user}
        customerId={deal.customerId}
        customerOwnerId={deal.customer?.ownerId ?? deal.ownerId}
        dealId={deal.id}
      />
    </>
  );
}
