"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { CustomerOwner } from "../../customer/domain/customer";
import type { CustomerView } from "../../customer/presentation/customer-api";
import { dealStageLabels, dealStages } from "../domain/deal";
import { date, dealRequest, yen, type DealView } from "./deal-api";
import styles from "./deal.module.css";

type PageData = {
  deals: DealView[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
export function DealList() {
  const params = useSearchParams();
  const query = params.toString();
  const [data, setData] = useState<PageData | null>(null);
  const [owners, setOwners] = useState<CustomerOwner[]>([]);
  const [customers, setCustomers] = useState<CustomerView[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      dealRequest<{ data: PageData }>(`/api/deals${query ? `?${query}` : ""}`),
      dealRequest<{ data: { owners: CustomerOwner[] } }>(
        "/api/customer-owners",
      ),
      dealRequest<{ data: { customers: CustomerView[] } }>(
        "/api/customers?pageSize=100",
      ),
    ])
      .then(([deals, ownerData, customerData]) => {
        if (active) {
          setData(deals.data);
          setOwners(ownerData.data.owners);
          setCustomers(customerData.data.customers);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "商談を取得できませんでした",
          );
      });
    return () => {
      active = false;
    };
  }, [query]);
  const pageHref = (page: number) => {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(page));
    return `/deals?${next}`;
  };
  return (
    <>
      <section className={styles.toolbar}>
        <form action="/deals" method="get" className={styles.filters}>
          <label>
            <span>顧客</span>
            <select
              key={`c-${customers.length}`}
              name="customerId"
              defaultValue={params.get("customerId") ?? ""}
            >
              <option value="">すべて</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>ステージ</span>
            <select name="stage" defaultValue={params.get("stage") ?? ""}>
              <option value="">すべて</option>
              {dealStages.map((s) => (
                <option key={s} value={s}>
                  {dealStageLabels[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>担当者</span>
            <select
              key={`o-${owners.length}`}
              name="ownerId"
              defaultValue={params.get("ownerId") ?? ""}
            >
              <option value="">すべて</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <button className={styles.button}>絞り込む</button>
          <Link className={styles.secondary} href="/deals">
            クリア
          </Link>
        </form>
        <Link className={styles.primary} href="/deals/new">
          商談を登録
        </Link>
      </section>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {data ? (
        <section className={styles.panel}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>商談</th>
                  <th>顧客</th>
                  <th>金額</th>
                  <th>ステージ</th>
                  <th>担当者</th>
                  <th>予定完了日</th>
                </tr>
              </thead>
              <tbody>
                {data.deals.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link href={`/deals/${d.id}`}>{d.title}</Link>
                    </td>
                    <td>{d.customer?.name}</td>
                    <td>{yen.format(d.amountCents)}</td>
                    <td>
                      <span className={styles.status}>
                        {dealStageLabels[d.stage]}
                      </span>
                    </td>
                    <td>{d.owner?.name}</td>
                    <td>{date(d.expectedCloseDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className={styles.pagination} aria-label="商談一覧のページ">
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
      ) : (
        <p>商談を読み込んでいます…</p>
      )}
    </>
  );
}
