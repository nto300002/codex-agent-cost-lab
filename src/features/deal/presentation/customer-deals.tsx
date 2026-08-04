"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { dealStageLabels } from "../domain/deal";
import { dealRequest, yen, type DealView } from "./deal-api";
import styles from "./deal.module.css";
export function CustomerDeals({ customerId }: { customerId: string }) {
  const [deals, setDeals] = useState<DealView[] | null>(null);
  useEffect(() => {
    let active = true;
    dealRequest<{ data: { deals: DealView[] } }>(
      `/api/deals?customerId=${customerId}&pageSize=100`,
    )
      .then((r) => {
        if (active) setDeals(r.data.deals);
      })
      .catch(() => {
        if (active) setDeals([]);
      });
    return () => {
      active = false;
    };
  }, [customerId]);
  return (
    <section className={styles.related}>
      <h2>関連商談</h2>
      <p>
        <Link
          className={styles.primary}
          href={`/deals/new?customerId=${customerId}`}
        >
          この顧客に商談を登録
        </Link>
      </p>
      {deals === null ? (
        <p>読み込んでいます…</p>
      ) : deals.length === 0 ? (
        <p>関連する商談はありません。</p>
      ) : (
        <div className={styles.panel}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>商談</th>
                <th>金額</th>
                <th>ステージ</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/deals/${d.id}`}>{d.title}</Link>
                  </td>
                  <td>{yen.format(d.amountCents)}</td>
                  <td>{dealStageLabels[d.stage]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
